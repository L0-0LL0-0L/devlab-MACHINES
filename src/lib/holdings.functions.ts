import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
export const walletHoldings=createServerFn({method:'POST'}).inputValidator((v:unknown)=>z.object({wallet:z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),cluster:z.enum(['mainnet-beta','devnet'])}).parse(v)).handler(async({data})=>{
 const {Connection,PublicKey}=await import('@solana/web3.js');const conn=new Connection(data.cluster==='devnet'?'https://api.devnet.solana.com':'https://api.mainnet-beta.solana.com','confirmed');const owner=new PublicKey(data.wallet);
 const programs=['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];const [sol,...accounts]=await Promise.all([conn.getBalance(owner),...programs.map(p=>conn.getParsedTokenAccountsByOwner(owner,{programId:new PublicKey(p)}))]);return {sol:sol/1e9,tokens:accounts.flatMap(a=>a.value.map(v=>{const info=v.account.data.parsed.info as {mint:string;tokenAmount:{amount:string;uiAmountString:string;decimals:number}};return {mint:info.mint,amount:info.tokenAmount.uiAmountString,raw:info.tokenAmount.amount,decimals:info.tokenAmount.decimals};})).filter(t=>t.raw!=='0')};
});
