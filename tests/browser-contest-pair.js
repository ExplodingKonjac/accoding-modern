(async()=>{
  const assert=(value,message)=>{if(!value)throw Error(message);},settle=async(check)=>{for(let i=0;i<150;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('pair UI did not settle');};
  const core=createAiReviewCore(),hash=async code=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))].map(value=>value.toString(16).padStart(2,'0')).join('');
  const author='770000000001',contest=990001,pidA=660001,pidB=660002,currentCode='/* PAIR_EARLIER_CURRENT */\nint main(){return 1;}\n',laterCode='/* PAIR_LATER_REFERENCE */\nint main(){return 2;}\n';
  const earlier={submission_id:'880000000001',creator_id:author,contest_id:contest,problem_id:pidA,code_hash:await hash(currentCode),created_at:'2026-10-01T10:00:00Z',verdict:'AC'};
  const later={...earlier,submission_id:'880000000002',problem_id:pidB,code_hash:await hash(laterCode),created_at:'2026-10-01T10:10:00Z'};
  const cohort=Array.from({length:25},(_,index)=>({...later,submission_id:String(880000000100+index),problem_id:660100+index,code_hash:'c'.repeat(64)}));
  const pair={comparison_mode:'within_contest_non_overlapping_pair_v1',pair_index:1,pair_id:'fixture-contest-pair',pair_problem_ids:[pidA,pidB],selected_problem_id:pidA,initial_target_reference:earlier,target_reference:earlier,selected_side:'earlier',comparison_references:[earlier,later],pair_references:[earlier,later],changed_evidence_groups:['helper_organization','comment_organization'],admission:'two_content_groups',cohort_role:'descriptive_only',cohort_references:cohort,pairing_population_references:[earlier,later]};
  const hit={...earlier,submission_id:'880000000901',created_at:'2026-10-01T09:40:00Z',role:'history_hit',annotation:{status:'suspected',reason:'模拟历史 AI 理由'}};
  const priorAc={...earlier,submission_id:'880000000902',created_at:'2026-10-01T09:45:00Z',role:'prior_ac'};delete priorAc.problem_id;
  const explicitChain={...earlier,submission_id:'880000000903',created_at:'2026-10-01T09:50:00Z',role:'history'};
  const otherProblem={...later,submission_id:'880000000904'},unknownProblem={...earlier,submission_id:'880000000905'};delete unknownProblem.problem_id;
  const record={submission_id:earlier.submission_id,creator_id:author,contest_id:contest,problem_id:pidA,run_id:'fixture-current-run',code:currentCode,code_hash:earlier.code_hash,review_status:'rule_hit_unreviewed',submitted_at:earlier.created_at,result:{label:['跨题码风变化'],reason:'同人同场固定配对'},rule_metadata:{cross_problem_style:pair},context_references:[later,...cohort],baseline_references:cohort,history_hits:[hit,otherProblem],prior_accepted_submissions:[priorAc],evidence_chain:[explicitChain,otherProblem,unknownProblem]};
  let references=0,ojReads=0,sessionCalls=0;const nativeFetch=window.fetch;
  const client={progress:async()=>({runs:[{run_id:record.run_id,contest_id:contest}]}),search:async()=>({reviews:[record],total:1}),detail:async()=>structuredClone(record),feedback:async()=>({latest:null,history:[]}),profile:async()=>({profile:{creator_id:author,summary:{coverage:{contest_ids:[contest],source_count:27}},evidence:[]},scope_contest_ids:[contest],scores_valid:true,status:'current'}),referenceSource:async ref=>{references++;assert(ref.submission_id===later.submission_id,'only the actual pair partner resolves');return {...later,submitted_at:later.created_at,evaluation_result:'AC'};},session:async()=>{sessionCalls++;throw Error('pair display never verifies writer identity');}};
  window.fetch=async url=>{ojReads++;assert(String(url)==='/submission/'+later.submission_id,'only selected actual pair source is fetched');return {ok:true,text:async()=>'<pre><code>'+laterCode+'</code></pre>'};};
  document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
  const context={generation:0,classId:'fixture',className:'模拟班级',contest:{id:contest,title:'模拟比赛',problems:[{id:pidA,label:'A',title:'题甲'},{id:pidB,label:'B',title:'题乙'}]},summary:{rows:[{userId:author,name:'模拟同学',studentId:'20260001',status:'matched'}]}};
  const panel=createAiReviewPanel(host,{...core,featureClient:()=>client},()=>context);
  try{
    await panel.setActive(true);await panel.openDetail(record.submission_id);
    const section=host.querySelector('[data-contest-pair]'),history=host.querySelector('[data-history-comparison]'),technical=section.querySelector('[data-pair-technical]');
    assert(section.textContent.includes('同场第 1 对')&&section.textContent.includes('配对已锁定'),'pair index and lock are explicit');
    assert(section.textContent.includes('本对只核查 A · 题甲')&&section.textContent.includes('当前提交是本次较早'),'selected problem remains the earlier target');
    assert(section.textContent.includes('对照晚于当前提交'),'later partner is not described as a historical baseline');
    assert(!technical.open&&technical.textContent.includes(cohort[0].submission_id),'cohort remains inside collapsed technical data');
    assert(section.querySelectorAll('a').length===2,'only two actual primary references are linked');
    assert(!history.open&&history.querySelector('summary').textContent.startsWith('配对代码对照（1 份'),'only one partner is available in the collapsed viewer');
    assert(references===0&&ojReads===0,'default pair display loads no source');
    const timeline=host.querySelector('[data-same-problem-timeline]');assert(timeline&&!timeline.open,'same-problem hit and AC history remain collapsed');
    const timelineIds=[...timeline.querySelectorAll('a')].map(link=>link.textContent.replace('提交 #',''));assert(JSON.stringify(timelineIds)===JSON.stringify([hit.submission_id,priorAc.submission_id,explicitChain.submission_id]),'only same-problem history and explicitly matching chain entries remain');
    assert(timeline.textContent.includes('有 AI')&&timeline.textContent.includes('模拟历史 AI 理由'),'historical human AI status and reason are preserved');
    timeline.querySelector('summary').click();await new Promise(resolve=>setTimeout(resolve,5));assert(references===0&&ojReads===0,'expanding the metadata timeline never requests history code');
    const note=host.querySelector('textarea');assert(note,'editor loads independently');note.value='配对未展开也可填写';
    history.querySelector('summary').click();await settle(()=>history.querySelector('[data-history-view]')?.textContent.includes('PAIR_LATER_REFERENCE'));
    assert(history.textContent.includes('同场配对对照')&&!history.textContent.includes('稳定基线'),'role label reflects same-contest pairing');
    assert(references===1&&ojReads===1&&host.querySelector('textarea')===note&&note.value==='配对未展开也可填写','one selected source loads without replacing the draft');
    record.rule_metadata.cross_problem_style.comparison_mode='stable-prior-nonformat-v1';await panel.openDetail(record.submission_id);
    assert(!host.querySelector('[data-contest-pair]')&&host.querySelector('[data-history-comparison] summary').textContent.startsWith('历史代码对照'),'legacy mode keeps its previous display');
    assert(sessionCalls===0,'new pair display has zero identity requests');
    return {passed:true,synthetic:true,sameContestPair:true,fixedSelectedProblem:true,earlierTargetLaterPartner:true,onlyActualReferences:true,cohortTechnicalCollapsed:true,sameProblemTimeline:true,historicalAiPreserved:true,timelineMetadataOnly:true,lazyPartnerOnly:true,draftPreserved:true,legacyCompatible:true,readSessionRequests:sessionCalls};
  }finally{panel.setActive(false);window.fetch=nativeFetch;}
})()
