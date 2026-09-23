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

test('v4 full class search requests all four statuses with a reviewer session',async()=>{
  const calls=[];
  const client=core.featureClient(()=>'session',async(url,options)=>{
    calls.push({url,options});
    const reply=new URL(url).pathname.endsWith('/progress')||new URL(url).pathname.endsWith('/runs')?{runs:[{run_id:'run-one',contest_id:1299,configuration_sha256:'b'.repeat(64)}]}:
      url.endsWith('/search')?{run_id:'run-one',total:1,reviews:[{...featurePositive,review_status:'rule_hit_unreviewed'}]}:{...featurePositive,review_status:'rule_hit_unreviewed'};
    return {ok:true,json:async()=>reply};
  },4);
  await client.progress(1299);await client.submissionRuns('1');
  await client.search({run_id:'run-one',contest_id:1299,creator_ids:['11'],limit:30,review_queue_only:true});
  await client.detail('1','run-one');
  assert.equal(calls.length,4);
  for(const {url,options} of calls){assert.match(url,/\/oj-review-api\/v4\//);assert.equal(options.headers.Authorization,'Bearer session');assert.equal(options.credentials,'omit');}
  const searchBody=JSON.parse(calls.find(x=>x.url.endsWith('/search')).options.body);
  assert.equal(searchBody.include_all,true);
  assert.equal(searchBody.review_queue_only,true);
});
test('review record validation accepts signed rules misses and rejects invented states',()=>{
  const miss={submission_id:'2',creator_id:'11',contest_id:1299,run_id:'run-one',decision_kind:'unflagged',configuration_sha256:'a'.repeat(64),code_hash:'b'.repeat(64),review_status:'rule_unmatched'};
  assert.equal(core.hasReviewRecord(miss),true);
  assert.equal(core.hasReviewRecord({...miss,review_status:'rule_hit_unreviewed'}),false);
  assert.equal(core.hasReviewRecord({...miss,review_status:'invented'}),false);
  assert.equal(core.hasReviewRecord({...miss,decision_kind:'rule_feature_unretained',review_status:'rule_hit_unreviewed'}),true);
  assert.equal(core.reviewStates.reviewed_no_ai,'已核查为无AI');
});

test('rule suspects share the review list without fabricated model receipts',()=>{
  const suspect={decision_kind:'rule_feature_candidate',rule_version:'rules-v7',call_id:null,
    configuration_sha256:'a'.repeat(64),code_hash:'b'.repeat(64),run_id:'e1',
    result:{ai_suspected:true,label:['代码结构大幅变化'],reason:'current:2-8 两次提交的结构发生明显变化。'}};
  assert.equal(core.hasFeatureReview(suspect),true);
  assert.equal(core.hasFeatureReview({...suspect,call_id:'fake-model'}),false);
  assert.equal(core.hasFeatureReview({...suspect,rule_version:''}),false);
  assert.equal(core.hasFeatureReview({...suspect,result:{...suspect.result,ai_suspected:false}}),false);
});

test('git-style line diff preserves both files and identifies unchanged lines',()=>{
  const before='int main() {\n  int a=1;\n  printf("%d",a);\n}',after='int main() {\n  int value=2;\n  printf("%d",value);\n}';
  const diff=core.lineDiff(before,after);
  assert.equal(diff.filter(r=>r.kind!=='add').map(r=>r.text).join('\n'),before);
  assert.equal(diff.filter(r=>r.kind!=='remove').map(r=>r.text).join('\n'),after);
  assert.deepEqual(diff.filter(r=>r.kind==='equal').map(r=>r.text),['int main() {','}']);
  assert.ok(diff.some(r=>r.kind==='remove')&&diff.some(r=>r.kind==='add'));
  for(const [a,b] of [['','x'],['a\na','a'],['x\ny','z\nx\ny\nz'],['a\nb\nc','a\nc\nb']]){
    const rows=core.lineDiff(a,b);
    assert.equal(rows.filter(r=>r.kind!=='add').map(r=>r.text).join('\n'),a);
    assert.equal(rows.filter(r=>r.kind!=='remove').map(r=>r.text).join('\n'),b);
  }
});

test('TA credentials authenticate feedback without changing the original rule schema',async()=>{
  const calls=[],client=core.featureClient(()=> 'ta-secret',async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({saved:true})};},4);
  await client.saveFeedback({submission_id:'1',status:'ordinary',reason:'已核对'});
  assert.equal(calls[0].opts.headers.Authorization,'Bearer ta-secret');
  assert.equal(JSON.parse(calls[0].opts.body).reason,'已核对');
  assert.ok(calls[0].url.endsWith('/feedback'));
});

test('review cursor continues after all 30 current-page records leave the queue',()=>{
  const rows=Array.from({length:65},(_,i)=>({submission_id:String(i+1)})),cursor=core.reviewCursor(rows.slice(0,30),0,65);
  for(let i=1;i<=30;i++){
    cursor.setVisible(String(i),false);
    assert.equal(cursor.has(String(i),1),true);
    assert.equal(cursor.neighbor(String(i),1),i<30?String(i+1):null);
  }
  const request=cursor.request(1);assert.deepEqual(request,{offset:0,limit:30});
  cursor.extend({reviews:rows.slice(30,60),total:35},request,1);
  assert.equal(cursor.neighbor('30',1),'31');assert.equal(cursor.has('31',-1),false);
  assert.deepEqual(cursor.request(1),{offset:30,limit:30});
});
test('review cursor preserves preceding records and fetches next page without skipping after mixed verdicts',()=>{
  const rows=Array.from({length:65},(_,i)=>({submission_id:String(i+1)})),cursor=core.reviewCursor(rows.slice(30,60),30,65);
  cursor.setVisible('60',false);cursor.setVisible('60',false);
  assert.equal(cursor.neighbor('60',-1),'59');assert.deepEqual(cursor.request(1),{offset:59,limit:30});
  cursor.extend({reviews:rows.slice(60),total:64},cursor.request(1),1);
  assert.equal(cursor.neighbor('60',1),'61');assert.equal(cursor.neighbor('61',-1),'59');assert.equal(cursor.has('65',1),false);
  const prior=cursor.request(-1);assert.deepEqual(prior,{offset:0,limit:30});cursor.extend({reviews:rows.slice(0,30),total:64},prior,-1);
  assert.equal(cursor.neighbor('31',-1),'30');assert.equal(cursor.has('1',-1),false);
  cursor.setVisible('60',true);assert.equal(cursor.neighbor('61',-1),'60');
});
test('review cursor handles a sole removed record and filtered AI verdicts',()=>{
  const cursor=core.reviewCursor([{submission_id:'1'}],0,1);cursor.setVisible('1',false);
  assert.equal(cursor.has('1',1),false);assert.equal(cursor.has('1',-1),false);
  cursor.setVisible('1',true);assert.equal(cursor.has('1',1),false);
});
