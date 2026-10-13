import {createFileRoute,redirect} from '@tanstack/react-router';
import {pageMeta} from '@/lib/page-meta';
export const Route=createFileRoute('/portfolio')({head:()=>pageMeta('Profile','devlab MACHINES workbench.'),beforeLoad:()=>{throw redirect({to:'/profile',statusCode:301});}});
