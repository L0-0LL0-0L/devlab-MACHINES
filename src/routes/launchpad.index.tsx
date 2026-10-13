import {createFileRoute,redirect} from '@tanstack/react-router';
import {pageMeta} from '@/lib/page-meta';
export const Route=createFileRoute('/launchpad/')({head:()=>pageMeta('Launch','devlab MACHINES workbench.'),beforeLoad:()=>{throw redirect({to:'/launch',statusCode:301});}});
