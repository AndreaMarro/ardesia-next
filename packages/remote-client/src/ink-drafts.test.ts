import {describe, expect, it} from 'vitest';
import {browserInkDraftStorage, parseInkDraft, type InkDraft, type InkDraftScope} from './ink-drafts';

class WebStorage {
  readonly values=new Map<string,string>(); fail=false;
  get length(){return this.values.size;}
  key(index:number){return [...this.values.keys()][index]??null;}
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){if(this.fail)throw Error('quota');this.values.set(key,value);}
  removeItem(key:string){this.values.delete(key);}
}
const scope:InkDraftScope={accountId:'teacher-a',workspaceId:'workspace-a',documentId:'lesson-a'};
function stroke(id='gesture-a'):InkDraft {return {object:{id,type:'ink',title:'Annotazione a penna',x:30,y:40,width:100,height:50,data:{points:[{x:0,y:0,pressure:.2},{x:100,y:50,pressure:.8}],color:'#203e62',width:2.5}},sampleTimes:[123,456]};}

describe('in-progress ink recovery, independent of immutable Core commands',()=>{
  it('checkpoints one gesture in place and retains exact samples through another browser adapter',()=>{
    const web=new WebStorage(),first=browserInkDraftStorage(web),second=browserInkDraftStorage(web),draft=stroke();
    first.write(scope,draft);
    for(let i=0;i<120;i++){draft.object.data.points[1]!.pressure=.2+i/200;first.write(scope,draft);}
    expect(web.length).toBe(1);expect(second.read(scope)).toEqual([draft]);
    second.write(scope,stroke('other-tab'));first.remove(scope,draft.object.id);
    expect(second.read(scope).map(row=>row.object.id)).toEqual(['other-tab']);
  });
  it('separates accounts, spaces and lessons, including delimiters in identifiers',()=>{
    const web=new WebStorage(),store=browserInkDraftStorage(web);
    store.write(scope,stroke());
    for(const other of [{...scope,accountId:'teacher-b'},{...scope,workspaceId:'workspace-b'},{...scope,documentId:'lesson-b'}, {...scope,accountId:'teacher-a/workspace-a'}]){
      expect(store.read(other)).toEqual([]);store.remove(other,'gesture-a');
    }
    expect(store.read(scope)).toEqual([stroke()]);
  });
  it('keeps the last durable checkpoint and original corrupt bytes exportable',()=>{
    const web=new WebStorage(),store=browserInkDraftStorage(web),draft=stroke();store.write(scope,draft);
    web.fail=true;const changed=stroke();changed.object.data.points[1]!.pressure=1;
    expect(()=>store.write(scope,changed)).toThrow('quota');expect(store.read(scope)).toEqual([draft]);
    web.fail=false;const key=web.key(0)!;web.setItem(key,'{"unfinished":');
    expect(()=>store.read(scope)).toThrow('byte originali');expect(JSON.parse(store.exportRaw(scope)).rows).toEqual([[key,'{"unfinished":']]);
    expect(web.getItem(key)).toBe('{"unfinished":');
  });
  it('refuses executable/non-ink content, mismatched IDs and impossible timing without changing bytes',()=>{
    expect(()=>parseInkDraft({...stroke(),sampleTimes:[1]})).toThrow();
    expect(()=>parseInkDraft({...stroke(),sampleTimes:[2,1]})).toThrow();
    expect(()=>parseInkDraft({...stroke(),object:{...stroke().object,type:'note',data:{text:'no'}}})).toThrow();
    const web=new WebStorage(),store=browserInkDraftStorage(web);store.write(scope,stroke());
    const key=web.key(0)!,raw=JSON.stringify(stroke('mismatched'));web.setItem(key,raw);
    expect(()=>store.read(scope)).toThrow();expect(web.getItem(key)).toBe(raw);
  });
});

class TestLocks {
 readonly held=new Set<string>();
 request=async<T>(name:string,_options:LockOptions,callback:LockGrantedCallback<T>):Promise<T>=>{
  if(this.held.has(name))return callback(null);
  this.held.add(name);try{return await callback({name,mode:'exclusive'} as Lock);}finally{this.held.delete(name);}
 };
}
it('never recovers a live writer; two stale recovery lists hand off exactly once after release',async()=>{
 const web=new WebStorage(),locks=new TestLocks() as unknown as Pick<LockManager,'request'>;
 const author=browserInkDraftStorage(web,locks),a=browserInkDraftStorage(web,locks),b=browserInkDraftStorage(web,locks);
 const draft=stroke();author.write(scope,draft);const stale=a.read(scope)[0]!;
 let count=0;const apply=async()=>{count++;return true;};
 expect(await a.recover(scope,stale.object.id,apply)).toBe(false);expect(count).toBe(0);
 const final=stroke();final.object.data.points.push({x:110,y:60,pressure:.9});final.sampleTimes.push(789);author.write(scope,final);
 author.release(scope,final.object.id);await Promise.resolve();await Promise.resolve();
 const captured:InkDraft[]=[];
 expect(await a.recover(scope,stale.object.id,async latest=>{captured.push(latest);return apply();})).toBe(true);
 expect(await b.recover(scope,stale.object.id,apply)).toBe(true);
 expect(count).toBe(1);expect(captured).toEqual([final]);expect(a.read(scope)).toEqual([]);
});
it('keeps original samples when recovery fails and refuses unlocked recovery on unsupported browsers',async()=>{
 const web=new WebStorage(),locks=new TestLocks() as unknown as Pick<LockManager,'request'>,store=browserInkDraftStorage(web,locks);
 store.write(scope,stroke());store.release(scope,'gesture-a');await Promise.resolve();await Promise.resolve();
 expect(await store.recover(scope,'gesture-a',async()=>false)).toBe(false);expect(store.read(scope)).toEqual([stroke()]);
 const unsupported=browserInkDraftStorage(web,null);
 await expect(unsupported.recover(scope,'gesture-a',async()=>true)).rejects.toThrow('Esporta');
 expect(JSON.parse(unsupported.exportRaw(scope)).rows).toHaveLength(1);
});
