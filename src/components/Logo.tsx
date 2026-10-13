import logo from '@/assets/devlab-machines-official-logo.jpeg.asset.json';
export function LogoMark({size=32,className}:{size?:number;className?:string}) {return <img src={logo.url} alt="" width={size} height={size} className={className}/>;}
export function Logo({className}:{className?:string}) {return <span className={`inline-flex items-center gap-2 ${className??''}`}><LogoMark size={38}/><span className="font-display text-base font-bold leading-tight">devlab <span className="block font-mono text-xs">MACHINES</span></span></span>;}
