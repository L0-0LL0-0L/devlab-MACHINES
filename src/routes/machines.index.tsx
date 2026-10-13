import {createFileRoute} from '@tanstack/react-router';
import {RegistryPage} from '@/components/registry-page';
import {pageMeta} from '@/lib/page-meta';
export const Route=createFileRoute('/machines/')({head:()=>pageMeta('Machines','Public coding machine machines and pinned repository evidence.'),component:()=> <RegistryPage kind="machines"/>});
