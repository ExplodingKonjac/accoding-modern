import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createAiReviewCore} from '../src/ai-review-core.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const core=createAiReviewCore(),code='int main(void){return 0;}';
const record=label=>({submission_id:'880000000601',creator_id:'770000000601',contest_id:990601,run_id:'fixture-style-run',decision_kind:'rule_feature_candidate',rule_version:'fixture-current-style',call_id:null,configuration_sha256:'b'.repeat(64),code_hash:createHash('sha256').update(code).digest('hex'),code,review_status:'rule_hit_unreviewed',result:{ai_suspected:true,label:[label],reason:'同题前后提交码风比较'},rule_metadata:{change:{seconds_between:86400}}});

test('new unbounded single-problem style label and historical timed label are both supported',()=>{
  for(const label of ['单题码风突变','短时间码风突变']){
    assert.equal(core.featureLabels.filter(item=>item===label).length,1);
    assert.equal(core.hasFeatureReview(record(label)),true);
    assert.equal(core.hasReviewRecord(record(label)),true);
  }
  assert.ok(core.featureLabels.includes('短时间大幅改写'),'rewrite retains its distinct timed label');
});

test('both style filters preserve their exact labels and use anonymous read requests',async()=>{
  const calls=[];let selected;
  const client=core.featureClient(()=>{throw Error('read must not inspect writer credentials');},async(url,options)=>{
    calls.push({url,options});selected=JSON.parse(options.body).label;
    return {ok:true,json:async()=>({run_id:'fixture-style-run',total:1,reviews:[record(selected)]})};
  },4);
  for(const label of ['单题码风突变','短时间码风突变']){
    const result=await client.search({run_id:'fixture-style-run',contest_id:990601,creator_ids:['770000000601'],offset:0,limit:30,label});
    assert.deepEqual(result.reviews[0].result.label,[label]);assert.equal(selected,label);
  }
  assert.deepEqual(calls.map(call=>JSON.parse(call.options.body).label),['单题码风突变','短时间码风突变']);
  assert.ok(calls.every(call=>call.options.headers.Authorization===undefined&&call.options.credentials==='omit'));
});

test('a current style result beyond 360 seconds is readable without applying a client time cutoff',async()=>{
  const value=record('单题码风突变');
  const client=core.featureClient(()=>'',async()=>({ok:true,json:async()=>value}),4);
  const result=await client.detail(value.submission_id,value.run_id);
  assert.equal(result.rule_metadata.change.seconds_between,86400);
  assert.deepEqual(result.result.label,['单题码风突变']);
});
