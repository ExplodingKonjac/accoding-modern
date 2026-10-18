(async()=>{
  const assert=(value,message)=>{if(!value)throw Error(message);},settle=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('UI did not settle');};
  const nativeTimer=window.setTimeout;let recomputeTimers=0,sessions=0,release;window.setTimeout=(fn,ms,...args)=>{if(ms===45000)recomputeTimers++;return nativeTimer(fn,ms,...args);};
  document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
  const core=createAiReviewCore(),reason='基线参考后来被人工判为有 AI 或存疑，该比较需重新核查并重跑；其他独立证据仍可查看。';
  const record={submission_id:'101',creator_id:'11',problem_id:1,contest_id:1327,run_id:'fixture',code:'int main(){}',code_hash:'a'.repeat(64),review_status:'rule_hit_unreviewed',raw_score:null,rule_score:65,auxiliary_score:null,profile_scores_valid:false,result:{label:['输入失败防护'],reason:'规则依据'},needs_recompute:true,recompute_reason:'baseline_feedback_changed',scope_explanation:reason};
  const evidence={submission_id:'101',creator_id:'11',contest_id:1327,code_hash:record.code_hash,needs_recompute:true,recompute_reason:'baseline_feedback_changed',scope_explanation:reason};
  const snapshot={profile:{creator_id:'11',summary:{coverage:{contest_ids:[1319,1327],source_count:10},permission_projection:{needs_recompute_submissions:2}},evidence:[evidence]},scope_contest_ids:[1319,1327],status:'current',scores_valid:true,cutoff:'2026-10-16T10:00:00Z'};
  let slow=true;
  const client={progress:async()=>({runs:[{run_id:'fixture',contest_id:1327}]}),search:async()=>({reviews:[record],total:1}),detail:async()=>structuredClone(record),feedback:async()=>({latest:null,history:[]}),session:async()=>{sessions++;throw Error('reads must not query writer session');},profile:async()=>{if(slow)await new Promise(resolve=>{release=resolve;});return structuredClone(snapshot);}};
  const context={generation:0,classId:'fixture',className:'测试班',contest:{id:1327,problems:[{id:1,label:'A',title:'测试题'}]},summary:{rows:[{userId:'11',studentId:'20260001',name:'测试同学',status:'matched'}]}};
  const panel=createAiReviewPanel(host,{...core,featureClient:()=>client},()=>context);
  try{
    await panel.setActive(true);await panel.openDetail('101');const note=host.querySelector('textarea');assert(note,'slow profile does not block editing');note.value='尚未保存的草稿';assert(host.querySelector('[data-score-recompute]').textContent===reason,'detail shows exact recalculation reason before profile');assert(!host.querySelector('[data-score-summary]').textContent.includes('65'),'explicit null never shows stored global65');
    slow=false;release();await settle(()=>host.querySelector('.ar-profile')?.innerText.includes('2 份历史比较待重新核查'));assert(host.querySelector('textarea')===note&&note.value==='尚未保存的草稿','background reason preserves editor and draft');
    assert(!host.querySelector('.ar-profile details'),'compact profile does not repeat every historical explanation');
    record.raw_score=60;record.auxiliary_score=60;record.profile_scores_valid=true;await panel.openDetail('101');assert(host.querySelector('[data-score-summary]').textContent.includes('原始分 60 · 画像辅助分 60'),'independent remainder remains visible');
    delete record.needs_recompute;delete record.recompute_reason;delete record.scope_explanation;evidence.code_hash='b'.repeat(64);await panel.openDetail('101');await settle(()=>host.querySelector('.ar-profile')?.innerText.includes('2 份历史比较'));assert(!host.querySelector('[data-score-recompute]')&&!host.querySelector('.ar-profile').innerText.includes('当前提交：'),'another hash cannot annotate the current source');
    assert(recomputeTimers===0,'frozen comparison invalidation does not create an automatic45s refresh');assert(sessions===0,'explanation and profile reads never verify writer identity');
    return {passed:true,explicitNullNoOld65:true,independent60Retained:true,summaryCount:true,currentExactIdentity:true,historyExplanation:true,draftPreserved:true,slowProfileNonblocking:true,noAutoRecomputePolling:true,readSessionRequests:sessions};
  }finally{panel.setActive(false);window.setTimeout=nativeTimer;}
})()
