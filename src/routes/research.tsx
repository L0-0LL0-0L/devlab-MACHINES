import {createFileRoute,redirect} from '@tanstack/react-router';
import {pageMeta} from '@/lib/page-meta';
export const Route=createFileRoute('/research')({head:()=>pageMeta('Machines','devlab MACHINES workbench.'),beforeLoad:()=>{throw redirect({to:'/machines',statusCode:301});}});
