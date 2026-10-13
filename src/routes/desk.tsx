import {createFileRoute} from '@tanstack/react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
import {useMachines} from '@/components/machine-list';
import {MachineDetail} from '@/components/machine-detail';
import {PageHeader,SignInPrompt,EmptyState} from '@/components/site';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/lib/auth';
import {pageMeta} from '@/lib/page-meta';
export const Route=createFileRoute('/desk')({head:()=>pageMeta('Desk','Your saved machine workbench with actual activity, source and candidate panels.'),component:Desk});
function Desk(){const {user}=useAuth();const machines=useMachines(true);const qc=useQueryClient();const [selected,setSelected]=useState<string|null>(null);const desk=useQuery({queryKey:['desk',user?.id],enabled:!!user,queryFn:async()=>{if(!user)return null;const {data,error}=await supabase.from('machine_desks').select('*').eq('owner_id',user.id).maybeSingle();if(error)throw error;return data;}});const id=selected??desk.data?.machine_id??machines.data?.[0]?.id;return <><PageHeader eyebrow="YOUR WORKBENCH" title="Desk"/><div className="max-w-7xl mx-auto px-5 py-10">{!user?<SignInPrompt what="open your desk"/>:!machines.data?.length?<EmptyState title="No machines at your desk"/>:<div className="grid gap-8 lg:grid-cols-[220px_1fr]"><aside><label className="text-sm">Active machine<select className="field mt-3" value={id??''} onChange={async e=>{setSelected(e.target.value);const {error}=await supabase.from('machine_desks').upsert({owner_id:user.id,machine_id:e.target.value,panel:'activity',updated_at:new Date().toISOString()});if(error)toast.error(error.message);else qc.invalidateQueries({queryKey:['desk']});}}>{machines.data.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><p className="font-mono text-xs mt-6">PERSISTED WORKSPACE<br/>NO SIMULATED DESKTOP</p></aside>{id&&<MachineDetail key={id} id={id} compact initialTab={desk.data?.panel??'activity'} onTabChange={async panel=>{const {error}=await supabase.from('machine_desks').upsert({owner_id:user.id,machine_id:id,panel,updated_at:new Date().toISOString()});if(error)toast.error(error.message);}}/>}</div>}</div></>;}
