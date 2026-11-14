import {it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {MaterialManifestSchema,materialPage,type NewEducationalObject} from '@ardesia/contracts';
import {browserOfflineStore} from './offline';
import {sha256} from './recordings';

it('retains original and exact page intents across reopen, rejects replacement, and scopes drafts to the account gate',async()=>{
  const factory=new IDBFactory(),store=browserOfflineStore(factory,'material-draft-test'),initial=await store.gate();
  await store.confirm(initial.generation,'owner','student',true);
  const blob=new Blob(['%PDF-1.7\nfixture']),digest=await sha256(await blob.arrayBuffer());
  const manifest=MaterialManifestSchema.parse({format:'ardesia-material-v1',assetId:'asset',documentId:'lesson',name:'Original.pdf',mimeType:'application/pdf',bytes:blob.size,sha256:digest,license:'CC0',pages:[{width:600,height:800}],parts:[{index:0,bytes:blob.size,sha256:digest}]});
  const object:NewEducationalObject={id:'page-intent',type:'material',title:'Page',x:20,y:30,width:300,height:400,data:materialPage(manifest,1)};
  const draft={manifest,blob,objects:[object]};await store.saveMaterialDraft!(initial.generation,'owner','workspace',draft);
  const reopened=browserOfflineStore(factory,'material-draft-test');const saved=await reopened.loadMaterialDraft!(initial.generation,'owner','workspace','lesson');
  expect(saved?.objects).toEqual([object]);expect(await saved?.blob.text()).toBe(await blob.text());
  await expect(store.saveMaterialDraft!(initial.generation,'owner','workspace',{...draft,objects:[{...object,id:'different'}]})).rejects.toThrow();
  expect((await reopened.loadMaterialDraft!(initial.generation,'owner','workspace','lesson'))?.objects[0]?.id).toBe('page-intent');
  const next=await store.close();await expect(reopened.loadMaterialDraft!(initial.generation,'owner','workspace','lesson')).rejects.toThrow();
  await store.confirm(next.generation,'other','student',true);expect(await store.loadMaterialDraft!(next.generation,'other','workspace','lesson')).toBeNull();
  const again=await store.close();await store.confirm(again.generation,'owner','student',true);
  expect((await store.loadMaterialDraft!(again.generation,'owner','workspace','lesson'))?.manifest.assetId).toBe('asset');
  await store.clearMaterialDraft!(again.generation,'owner','workspace','lesson','wrong');expect(await store.loadMaterialDraft!(again.generation,'owner','workspace','lesson')).not.toBeNull();
  await store.clearMaterialDraft!(again.generation,'owner','workspace','lesson','asset');expect(await store.loadMaterialDraft!(again.generation,'owner','workspace','lesson')).toBeNull();
});
