REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.machines,public.machine_jobs,public.machine_events,public.machine_candidates,public.machine_replays,public.machine_generations,public.machine_ledger FROM anon,authenticated;
REVOKE ALL ON public.machine_runners FROM anon,authenticated;
REVOKE ALL ON public.machine_jobs,public.machine_ledger FROM anon;
GRANT SELECT ON public.machines,public.machine_events,public.machine_candidates,public.machine_replays,public.machine_generations TO anon,authenticated;
GRANT SELECT ON public.machine_jobs,public.machine_ledger TO authenticated;