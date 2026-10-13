import {createFileRoute,redirect} from '@tanstack/react-router';
import {pageMeta} from '@/lib/page-meta';
export const Route=createFileRoute('/community')({head:()=>pageMeta('Explorer','devlab MACHINES workbench.'),beforeLoad:()=>{throw redirect({to:'/explorer',statusCode:301});}});
