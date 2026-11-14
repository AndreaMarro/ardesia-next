import {lazy,Suspense,type ComponentProps} from 'react';
const PreparedHandout=lazy(()=>import('./HandoutView').then(module=>({default:module.HandoutView})));
export function HandoutView(props:ComponentProps<typeof import('./HandoutView')['HandoutView']>){
  return <Suspense fallback={<p role="status" className="handout-screen-note">Apertura della dispensa…</p>}><PreparedHandout {...props}/></Suspense>;
}
