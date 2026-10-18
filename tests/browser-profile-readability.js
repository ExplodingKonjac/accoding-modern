(async()=>{
  const assert=(value,message)=>{if(!value)throw Error(message);};document.body.replaceChildren();document.title='历史代码摘要 · 1.20.1 验收';
  const core=createAiReviewCore(),host=document.createElement('main');document.body.append(host);
  const style=document.createElement('style');style.textContent='body{font:15px/1.65 system-ui;color:#25344b;margin:20px}button,select{font:inherit;padding:8px 14px;border:1px solid #cad6e6;border-radius:8px;background:white;color:inherit}button:disabled{opacity:.5}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #dce3ed}.table-wrap{overflow:auto}[hidden]{display:none!important}';document.head.append(style);
  const record={submission_id:'8513767',creator_id:'11',problem_id:101,contest_id:1327,run_id:'fixture',code:'int main(void){return 0;}',code_hash:'a'.repeat(64),review_status:'rule_hit_unreviewed',evaluation_result:'AC',submitted_at:'2026-10-16T08:00:00Z',raw_score:60,auxiliary_score:40,result:{label:['输入失败防护'],reason:'检查输入失败分支'},rule_metadata:{change:{status:'unavailable',explanation:'授权范围不足，历史证据不可用'},quick_pass:{status:'unavailable',explanation:'授权范围不足，历史证据不可用'}}};
  const snapshot={profile:{creator_id:'11',summary:{coverage:{contest_ids:[1327],source_count:10,first_seen:'2026-10-15T06:20:00Z',last_seen:'2026-10-16T08:00:00Z',parse_failed:0},baseline:{status:'provisional',sample_count:6,problem_count:6,samples:[]},habits:{comment:{present:0,applicable:6,samples:[]},input_guard:{present:0,applicable:6,samples:[]}},distribution:{1327:{source_count:10,hit_problems:2,human_counts:{ordinary:1,uncertain:0,suspected:0}}}}},status:'current',scores_valid:true,permission_coverage:'full',scope_contest_ids:[1327],cutoff:'2026-10-16T08:10:48Z',feedback_revision:404,snapshot_id:'sha256-hidden-by-default',version:'profiles-internal-v1'};
  const client={progress:async()=>({runs:[{run_id:'fixture',contest_id:1327,publication_ready:true}]}),search:async()=>({reviews:[record],total:1}),detail:async()=>record,profile:async()=>snapshot,feedback:async()=>({latest:null,history:[]}),session:async()=>({review_state_protocol:2,human_statuses:['ordinary','uncertain','suspected']})};
  const context={generation:0,classId:'fixture',className:'测试班',contest:{id:1327,title:'C语言程序设计 C4',problems:[{id:101,label:'A',title:'输入输出练习'}]},summary:{rows:[{userId:'11',studentId:'20260001',name:'测试同学',status:'matched'}]}};
  const panel=createAiReviewPanel(host,{...core,featureClient:()=>client},()=>context);await panel.setActive(true);await panel.openDetail(record.submission_id);
  const profile=host.querySelector('.ar-profile'),text=profile.innerText;
  assert(text.includes('历史命中该记录的代码'),'compact heading');
  assert(text.includes('暂无历史命中记录'),'empty history is explicit');
  assert(!/习惯参照|技术详情|可比较的代码|统计更新|当前画像包含/.test(text),'narrative wall removed');
  snapshot.profile.evidence=[{submission_id:'8513000',contest_id:1327,rule_reasons:['input_status_condition_candidate']},{submission_id:'8513001',contest_id:1327,rule_reasons:[]},{submission_id:record.submission_id,contest_id:1327,rule_reasons:['input_status_condition_candidate']}];
  await panel.openDetail(record.submission_id);await new Promise(resolve=>setTimeout(resolve,10));
  const links=[...host.querySelectorAll('.ar-profile a')];
  assert(links.length===1&&links[0].href.endsWith('/submission/8513000'),'only other hit submissions become source links');
  assert(host.querySelector('.ar-profile').getBoundingClientRect().height<130,'history block stays compact');
  assert(!host.innerText.includes('可执行代码差异：0.0%'),'withheld change cannot become a fake zero diff');
  snapshot.profile.evidence=Array.from({length:30},(_,i)=>({submission_id:String(8700000+i),contest_id:1327,rule_reasons:i===29?[]:['input_status_condition_candidate'],needs_recompute:i===29}));
  await panel.openDetail(record.submission_id);await new Promise(resolve=>setTimeout(resolve,10));
  const large=host.querySelector('.ar-profile');assert(large.querySelectorAll('a').length===6&&!large.querySelector('details').open,'long histories start with six links');
  large.querySelector('summary').click();await new Promise(resolve=>setTimeout(resolve,10));assert(large.querySelectorAll('a').length===30&&large.textContent.includes('待重核'),'remaining hits and invalidated comparisons remain available');
  panel.setActive(false);
  return {passed:true,compactHistory:true,sourceLinksOnly:true,currentAndUnhitExcluded:true};
})()
