import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/runner/propose')({server:{handlers:{POST:async({request})=>{try{const {runnerRequest}=await import('@/lib/runner.server');return await runnerRequest(request,'propose');}catch(e){return Response.json({error:(e as Error).message},{status:400});}}}}});
