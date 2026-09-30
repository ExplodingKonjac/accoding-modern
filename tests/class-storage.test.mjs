import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/class-storage.js',import.meta.url),'utf8');
const key='accoding-modern.classes.v1';
const entry=id=>({id,name:'班级'+id,members:[{studentId:'001',name:'学生'}]});
const storage=map=>({getItem:name=>map.get(name)||null,setItem:(name,value)=>map.set(name,value)});
const shared=map=>({get:(name,fallback)=>map.get(name)??fallback,set:(name,value)=>map.set(name,value)});
const create=(local,remote)=>vm.runInNewContext(source+';createClassStorage(local,remote)',{local,remote,Date,Math,JSON});

test('migrates an existing direct-site roster and reads it on VPN',()=>{
  const direct=new Map([[key,JSON.stringify({version:1,classes:[entry('a')]})]]),vpn=new Map(),common=new Map();
  assert.equal(create(storage(direct),shared(common)).load().length,1);
  assert.equal(create(storage(vpn),shared(common)).load()[0].id,'a');
  assert.equal(JSON.parse(vpn.get(key)).classes[0].name,'班级a');
});

test('changes on VPN become visible on direct site without reviving a deleted class',()=>{
  const direct=new Map(),vpn=new Map(),common=new Map();
  const first=create(storage(direct),shared(common));first.load();first.save([entry('a')]);
  const second=create(storage(vpn),shared(common));second.load();second.save([]);
  assert.equal(create(storage(direct),shared(common)).load().length,0);
});

test('independent legacy rosters merge, conflicting edits stop instead of overwriting',()=>{
  const direct=new Map([[key,JSON.stringify({version:1,classes:[entry('a')]})]]),vpn=new Map([[key,JSON.stringify({version:1,classes:[entry('b')]})]]),common=new Map();
  create(storage(direct),shared(common)).load();
  assert.equal(create(storage(vpn),shared(common)).load().length,2);
  const conflict=new Map([[key,JSON.stringify({version:1,classes:[{...entry('a'),name:'其他版本'}]})]]);
  assert.throws(()=>create(storage(conflict),shared(common)).load(),/不同版本/);
  assert.equal(JSON.parse(common.get(key)).classes.length,2);
});

test('stale tabs cannot overwrite newer changes',()=>{
  const common=new Map(),first=create(storage(new Map()),shared(common)),second=create(storage(new Map()),shared(common));
  first.load();first.save([entry('a')]);second.load();first.save([entry('b')]);
  assert.throws(()=>second.save([entry('c')]),/其他页面/);
  assert.equal(JSON.parse(common.get(key)).classes[0].id,'b');
});

test('without script-manager storage, existing local persistence still works',()=>{
  const local=new Map(),store=create(storage(local),{});
  assert.equal(store.load().length,0);
  store.save([entry('a')]);
  assert.equal(store.load()[0].id,'a');
});
