import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionCore} from '../src/submission-core.mjs';
const core=createSubmissionCore();
const current={id:'50',creator_id:'7',problem_id:'9',timestamp:5000};
const row=(id,extra={})=>({...current,id:String(id),timestamp:Number(id)*100,...extra});
test('submission header is bound to ID and preserves source whitespace and authored comments',()=>{
  const body='\n/* my note */\nint main() { return 0; }\n';
  const header='/* \n Author: Test(Name)(7)\n Result: AC\tSubmission_id: 50\n Created at: Tue Sep 22 2026 20:49:50 GMT+0800 (China Standard Time)\n Problem: 9\tTime: 41\tMemory: 7484\n*/';
  const parsed=core.parse(header+'\n\n'+body,'50');
  assert.equal(parsed.code,body);assert.equal(parsed.creator_id,'7');assert.equal(parsed.nickname,'Test(Name)');
  assert.throws(()=>core.parse(header+body,'51'));assert.throws(()=>core.parse('int main(){}','50'));
});
test('previous version uses exact person and problem, excludes future and breaks timestamp ties by ID',()=>{
  const rows=[row(49,{creator_id:'8'}),row(48,{problem_id:'10'}),row(47,{timestamp:6000}),row(46),row(45),row(51,{timestamp:4900}),current];
  assert.equal(core.previous(rows,current).id,'46');
  assert.equal(core.previous([row(48,{timestamp:5000}),row(49,{timestamp:5000})],current).id,'49');
  assert.equal(core.previous([current],current),null);
});
test('previous query follows all pages, includes failed attempts and confirms first submission',async()=>{
  const pages=[{rows:[row(51),current],next:15},{rows:[row(49,{creator_id:'8'}),row(48,{result:'WA'})],next:30},{rows:[],next:45}];
  const offsets=[];const previous=await core.findPrevious(current,async offset=>{offsets.push(offset);return pages.shift();});
  assert.equal(previous.id,'48');assert.deepEqual(offsets,[0,15,30]);
  assert.equal(await core.findPrevious(current,async()=>({rows:[current],next:null})),null);
});
test('incomplete, repeated, failed or cancelled queries cannot be mistaken for no prior submission',async()=>{
  await assert.rejects(core.findPrevious(current,async()=>({rows:[],next:null})),/未返回本次/);
  await assert.rejects(core.findPrevious(current,async()=>({rows:[current],next:15})),/重复/);
  await assert.rejects(core.findPrevious(current,async()=>({rows:[current],next:0})),/分页异常/);
  await assert.rejects(core.findPrevious(current,async()=>{throw Error('offline');}),/offline/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(core.findPrevious(current,async()=>{throw Error('must not fetch');},controller.signal),{name:'AbortError'});
});
