import test from 'node:test';
import assert from 'node:assert/strict';
import {createAiReviewCore} from '../src/ai-review-core.mjs';
import {webcrypto,createHash} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const core=createAiReviewCore();
const positive={submission_id:'1',contest_id:1299,creator_id:'11',ai_suspected:true,score:.9,threshold:.8,model_digest:'a'.repeat(64)};
test('visibility requires an explicit positive model decision, not old priorities',()=>{
  assert.equal(core.hasFlaggedReview(positive),true);
  for(const change of [{ai_suspected:false},{ai_suspected:'true'},{score:.7},{score:NaN},{model_digest:null},{threshold:undefined}])assert.equal(core.hasFlaggedReview({...positive,...change}),false);
  assert.equal(core.hasFlaggedReview({state:'completed',inference_performed:true,review_priority:'priority'}),false);
});
test('only uniquely matched member IDs are submitted to the class query',()=>{
  assert.deepEqual([...core.members([{status:'matched',userId:11},{status:'ambiguous',userId:22},{status:'matched',userId:'bad'}]).keys()],['11']);
});
test('class results are paginated directly without fetching submission metadata',async()=>{
  const calls=[];const c=core.client(()=>'t'.repeat(48),async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({total:31,reviews:[positive]})};});
  const q={contest_id:1299,creator_ids:['11'],offset:30,limit:30};assert.equal((await c.search(q)).total,31);
  assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/v2/reviews/search'));assert.deepEqual(JSON.parse(calls[0].options.body),q);assert.equal(calls[0].options.credentials,'omit');
});
test('wrong-class and nonpositive responses are errors, not silent empty results',async()=>{
  for(const r of [{...positive,creator_id:'22'},{...positive,contest_id:1304},{...positive,ai_suspected:false}]){
    const c=core.client(()=>'token',async()=>({ok:true,json:async()=>({total:1,reviews:[r]})}));
    await assert.rejects(()=>c.search({contest_id:1299,creator_ids:['11'],limit:30}),/当前班级/);
  }
});
test('a removed or absent detail is represented as absent, while auth errors remain errors',async()=>{
  const c=core.client(()=>'token',async()=>({ok:false,status:404}));assert.equal(await c.detail('1'),null);
  const denied=core.client(()=>'token',async()=>({ok:false,status:403}));await assert.rejects(()=>denied.detail('1'),/只读令牌/);
});
const code='int main(){return 0;}';
const featurePositive={submission_id:'1',contest_id:1299,creator_id:'11',run_id:'run-one',decision_kind:'llm_feature_presence',configuration_sha256:'b'.repeat(64),model_digest:'a'.repeat(64),code_hash:createHash('sha256').update(code).digest('hex'),code,result:{ai_suspected:true,label:['讲解性注释'],reason:'current:1 讲解性注释。'}};
test('feature results require exact three fields and known unique labels without a score',()=>{
  assert.equal(core.hasFeatureReview(featurePositive),true);
  for(const change of [{ai_suspected:false},{ai_suspected:'true'},{label:[]},{label:['旧标签']},{label:['讲解性注释','讲解性注释']},{reason:''},{confidence:.9}])assert.equal(core.hasFeatureReview({...featurePositive,result:{...featurePositive.result,...change}}),false);
  assert.equal(core.hasFeatureReview(positive),false);
});
test('feature queries bind every returned item to the selected run and class',async()=>{
  const q={run_id:'run-one',contest_id:1299,creator_ids:['11'],limit:30};
  const request=reply=>core.featureClient(()=>'token',async(url,options)=>({ok:true,json:async()=>reply}));
  assert.equal((await request({run_id:q.run_id,total:1,reviews:[featurePositive]}).search(q)).total,1);
  for(const change of [{run_id:'run-two'},{contest_id:1304},{creator_id:'22'}])await assert.rejects(()=>request({run_id:q.run_id,total:1,reviews:[{...featurePositive,...change}]}).search(q),/当前运行或班级/);
  await assert.rejects(()=>request({run_id:'run-two',total:0,reviews:[]}).search(q),/运行无效/);
  await assert.rejects(()=>request({}).search({...q,run_id:undefined}),/选择核查运行/);
});
test('details and on-demand context require matching exact source hashes',async()=>{
  assert.equal(await core.verifySource(code,featurePositive.code_hash),code);
  await assert.rejects(()=>core.verifySource(code+'\n',featurePositive.code_hash),/哈希/);
  const request=value=>core.featureClient(()=>'token',async()=>({ok:true,json:async()=>value}));
  assert.deepEqual(await request(featurePositive).detail('1','run-one'),featurePositive);
  await assert.rejects(()=>request({...featurePositive,code:'changed'}).detail('1','run-one'),/哈希/);
  await assert.rejects(()=>request(featurePositive).detail('2','run-one'),/提交不一致/);
  await assert.rejects(()=>request(featurePositive).detail('1','run-two'),/运行或提交不一致/);
});
test('OJ metadata wrapper is removed only for the matching submission and frozen source hash',async()=>{
  const header='/* \n Author: fixture\n Result: AC Submission_id: 99\n Created at: fixture\n*/\n\n';
  assert.equal(await core.sourceFromOj(header+code,'99',featurePositive.code_hash),code);
  await assert.rejects(()=>core.sourceFromOj(header+code,'100',featurePositive.code_hash),/提交编号/);
  await assert.rejects(()=>core.sourceFromOj(header+code+'changed','99',featurePositive.code_hash),/哈希/);
});
