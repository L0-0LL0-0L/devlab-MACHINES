import {parseRepository} from './machine-core';
async function github(path:string,raw=false) {
 const response=await fetch('https://api.github.com'+path,{headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','User-Agent':'devlab-machines'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok) throw new Error(`GitHub ${response.status}: ${response.status===404?'Public repository or file not found':(await response.text()).slice(0,250)}`);
 const reader=response.body?.getReader(); if(!reader) throw new Error('GitHub returned no body'); let result='',size=0;const dec=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>250000){await reader.cancel();throw new Error('GitHub response exceeds 250 KB');}result+=dec.decode(value,{stream:true});}return result;
}
export async function repositorySnapshot(url:string) {
 const {owner,repo,url:canonicalUrl}=parseRepository(url);const base=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
 const meta=JSON.parse(await github(base)) as {private:boolean;archived:boolean;default_branch:string;description:string;stargazers_count:number;language:string;license:{spdx_id:string}|null};
 if(meta.private||meta.archived)throw new Error('Repository must be public and not archived');
 const commits=JSON.parse(await github(base+'/commits?sha='+encodeURIComponent(meta.default_branch)+'&per_page=1')) as {sha:string}[]; const commit=commits[0]; if(!commit)throw new Error('Repository has no commit');
 if(!/^[a-f0-9]{40}$/.test(commit.sha))throw new Error('GitHub did not provide a pinned commit');
 let readme='';try{readme=(await github(base+'/readme?ref='+commit.sha,true)).slice(0,20000);}catch(e){if(!(e instanceof Error)||!e.message.includes('404'))throw e;}
 return {owner,repo,url:canonicalUrl,branch:meta.default_branch,commit:commit.sha,description:meta.description??'',stars:meta.stargazers_count,language:meta.language??'',license:meta.license?.spdx_id??'NOASSERTION',readme};
}
export async function pinnedFile(url:string,commit:string,path:string) {
 const {owner,repo}=parseRepository(url);if(!/^[a-f0-9]{40}$/.test(commit)||path.startsWith('/')||path.split('/').some(p=>p==='..'||p==='.git'))throw new Error('Unsafe pinned file');
 return github(`/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`,true);
}
