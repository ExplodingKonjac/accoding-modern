import test from 'node:test';
import assert from 'node:assert/strict';
import {createAiReviewCore} from '../src/ai-review-core.mjs';
const hash='a'.repeat(64),current={submission_id:'900000000001',creator_id:'920000000001',contest_id:1323,problem_id:10709,run_id:'current-c4'};
const ref={submission_id:'910000000001',code_hash:hash};
const source={submission_id:'910000000001',code_hash:hash,creator_id:'920000000001',contest_id:1315,problem_id:10399,submitted_at:'2026-10-15T12:00:00Z',evaluation_result:'AC'};
const run=(run_id='history-c3',extra={})=>({run_id,contest_id:1315,configuration_sha256:'b'.repeat(64),created_at:1,publication_ready:true,...extra});
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
function client(handler){const calls=[];return {calls,api:createAiReviewCore().featureClient(()=>{throw Error('anonymous reads must not inspect credentials');},async(url,options)=>{calls.push({url,options});assert.equal(options.headers.Authorization,undefined);assert.equal(options.credentials,'omit');return handler(url,options);},4)};}
test('bare cross-contest reference discovers its own complete run and fills missing metadata',async()=>{
 const {api,calls}=client(url=>url.includes('/submissions/910000000001/runs')?response({runs:[run()]}):response(source));
 const value=await api.referenceSource(ref,current);assert.equal(value.run_id,'history-c3');assert.equal(value.problem_id,10399);
 assert.equal(calls.length,2);assert.ok(calls[1].url.includes('/runs/history-c3/sources/910000000001'));assert.ok(calls.every(c=>!c.url.includes('current-c4')));
});
for(const locator of ['history-c3',{run_id:'history-c3'}])test('explicit historical locator is a run identity, not the current run: '+JSON.stringify(locator),async()=>{
 const {api,calls}=client(()=>response(source));const actual=await api.referenceSource({...ref,source_locator:locator,contest_id:'1315',problem_id:'10399'},current);
 assert.equal(actual.run_id,'history-c3');assert.equal(calls.length,1);assert.ok(calls[0].url.includes('/runs/history-c3/sources/'));
});
test('known same-contest reference can use the selected frozen run',async()=>{
 const {api,calls}=client(()=>response({...source,contest_id:1323}));await api.referenceSource({...ref,contest_id:1323},current);assert.ok(calls[0].url.includes('/runs/current-c4/sources/'));assert.equal(calls.length,1);
});
test('a true missing historical locator can discover another complete snapshot of the same identity',async()=>{
 const {api,calls}=client(url=>url.includes('/runs/obsolete/')?response({detail:'not in this run'},404):url.includes('/submissions/910000000001/runs')?response({runs:[run('pending',{created_at:10,publication_ready:false}),run()]}):response(source));
 const actual=await api.referenceSource({...ref,source_locator:'obsolete'},current);assert.equal(actual.run_id,'history-c3');assert.equal(calls.length,3);assert.ok(calls.every(c=>!c.url.includes('/runs/pending/')));
});
test('discovery tries complete snapshots only and continues only after source 404',async()=>{
 const {api,calls}=client(url=>url.includes('/submissions/910000000001/runs')?response({runs:[run('newer',{created_at:2}),run()]}):url.includes('/runs/newer/')?response({},404):response(source));
 assert.equal((await api.referenceSource(ref,current)).run_id,'history-c3');assert.equal(calls.length,3);
});
for(const [name,patch,expected] of [
 ['hash',{code_hash:'c'.repeat(64)},{}],['author',{creator_id:'920000000002'},{}],['source contest',{contest_id:1305},{contest_id:1315}],['source problem',{problem_id:999},{problem_id:'10399'}],['reference author',{}, {creator_id:'920000000002'}],['run identity',{run_id:'wrong-run'},{}],['invalid problem',{problem_id:'unknown'},{}]
])test('historical identity mismatch is rejected without trying another run: '+name,async()=>{
 const {api,calls}=client(()=>response({...source,...patch}));await assert.rejects(api.referenceSource({...ref,source_locator:'history-c3',...expected},current),/不一致/);assert.equal(calls.length,1);
});
test('discovered source must match its run contest even when original reference lacks contest metadata',async()=>{
 const {api}=client(url=>url.includes('/submissions/910000000001/runs')?response({runs:[run()]}):response({...source,contest_id:1299}));await assert.rejects(api.referenceSource(ref,current),/不一致/);
});
for(const status of [401,403,409,426,500])test('HTTP '+status+' is not hidden as an absent historical reference',async()=>{
 const {api,calls}=client(()=>response({detail:'server refused'},status));await assert.rejects(api.referenceSource({...ref,run_id:'history-c3'},current),e=>e.httpStatus===status);assert.equal(calls.length,1);
});
test('network errors are not hidden as absent references',async()=>{
 const {api,calls}=client(()=>{throw Error('network interrupted');});await assert.rejects(api.referenceSource({...ref,run_id:'history-c3'},current),/network interrupted/);assert.equal(calls.length,1);
});
test('successful pinned identity cache rechecks expectations, and failed identity is not cached',async()=>{
 let wrong=true;const {api,calls}=client(()=>response(wrong?{...source,creator_id:'0'}:source));const pinned={...ref,run_id:'history-c3'};
 await assert.rejects(api.referenceSource(pinned,current),/不一致/);wrong=false;await api.referenceSource(pinned,current);await api.referenceSource(pinned,current);assert.equal(calls.length,2);
 await assert.rejects(api.referenceSource({...pinned,problem_id:'999'},current),/不一致/);assert.equal(calls.length,2);
});
test('cancelled source load does not poison retries',async()=>{
 let pending=true;const {api,calls}=client((url,options)=>pending?new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true})):response(source));
 const controller=new AbortController(),pinned={...ref,run_id:'history-c3'},loading=api.referenceSource(pinned,current,controller.signal);controller.abort();await assert.rejects(loading,{name:'AbortError'});
 pending=false;assert.equal((await api.referenceSource(pinned,current)).run_id,'history-c3');assert.equal(calls.length,2);
});
test('empty run discovery is not cached and retry can recover',async()=>{
 let ready=false;const {api,calls}=client(url=>url.includes('/submissions/910000000001/runs')?response({runs:ready?[run()]:[]}):response(source));
 await assert.rejects(api.referenceSource(ref,current),/尚无可读取/);ready=true;await api.referenceSource(ref,current);assert.equal(calls.length,3);
});
for(const bad of [{...ref,source_locator:'https://example.com/source'},{...ref,source_locator:{}},{...ref,run_id:'one',source_locator:'two'},{...ref,code_hash:'invalid'},{...ref,submission_id:'bad'}])test('invalid reference or locator is rejected before network: '+JSON.stringify(bad),async()=>{
 const {api,calls}=client(()=>response(source));await assert.rejects(api.referenceSource(bad,current));assert.equal(calls.length,0);
});
