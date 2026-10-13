ALTER TABLE public.machines ADD COLUMN funding_config jsonb;
CREATE TABLE public.machine_funding_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),machine_id uuid NOT NULL REFERENCES public.machines(id),owner_id uuid NOT NULL,cluster text NOT NULL CHECK(cluster IN ('devnet','mainnet-beta')),signature text NOT NULL,amount_lamports numeric(20,0) NOT NULL CHECK(amount_lamports>0),sender text NOT NULL,recipient text NOT NULL,kind text NOT NULL CHECK(kind IN ('received','claimed_fee_transfer')),slot bigint NOT NULL,provenance jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(cluster,signature));
GRANT SELECT ON public.machine_funding_receipts TO authenticated; GRANT ALL ON public.machine_funding_receipts TO service_role;
ALTER TABLE public.machine_funding_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY funding_receipt_owner ON public.machine_funding_receipts FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE OR REPLACE FUNCTION public.record_machine_funding(p_machine uuid,p_owner uuid,p_cluster text,p_signature text,p_amount text,p_sender text,p_recipient text,p_slot bigint,p_provenance jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m machines; existing machine_funding_receipts; r machine_funding_receipts;
BEGIN SELECT * INTO m FROM machines WHERE id=p_machine AND owner_id=p_owner FOR UPDATE;
 IF m.id IS NULL OR m.funding_config->>'cluster'<>p_cluster OR m.funding_config->>'recipient'<>p_recipient OR m.funding_config->>'purpose'<>'self-hosted' OR m.runtime<>'self-hosted' OR p_amount!~'^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Funding identity/configuration mismatch'; END IF;
 SELECT * INTO existing FROM machine_funding_receipts WHERE cluster=p_cluster AND signature=p_signature;
 IF existing.id IS NOT NULL THEN IF existing.machine_id<>p_machine OR existing.amount_lamports<>p_amount::numeric OR existing.sender<>p_sender OR existing.recipient<>p_recipient THEN RAISE EXCEPTION 'Receipt already assigned'; END IF; RETURN to_jsonb(existing); END IF;
 INSERT INTO machine_funding_receipts(machine_id,owner_id,cluster,signature,amount_lamports,sender,recipient,kind,slot,provenance) VALUES(p_machine,p_owner,p_cluster,p_signature,p_amount::numeric,p_sender,p_recipient,'received',p_slot,p_provenance) RETURNING * INTO r;
 INSERT INTO machine_events(machine_id,owner_id,kind,message) VALUES(p_machine,p_owner,'funding','Confirmed machine-specific SOL deposit reconciled'); RETURN to_jsonb(r);
END; $$;
REVOKE ALL ON FUNCTION public.record_machine_funding(uuid,uuid,text,text,text,text,text,bigint,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.record_machine_funding(uuid,uuid,text,text,text,text,text,bigint,jsonb) TO service_role;