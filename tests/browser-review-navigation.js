(async()=>{
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const settle=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw Error('UI did not settle');};
  document.getElementById('review-navigation-fixture')?.remove();
  const core=createAiReviewCore(),host=document.createElement('div');host.id='review-navigation-fixture';document.body.append(host);const root=host.attachShadow({mode:'open'});
  const theme=document.createElement('style');theme.textContent=':host{font:15px system-ui;color:#25344b}button,select{padding:10px;border:1px solid #cad6e6;border-radius:8px;background:white;color:inherit;cursor:pointer}button:disabled{opacity:.4}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #dce3ed}.table-wrap{overflow:auto;max-height:55vh}.pager{display:flex;gap:10px;justify-content:flex-end;margin:16px 0}.panel[hidden]{display:none}';root.append(theme);
  const container=document.createElement('div');root.append(container);
  const records=Array.from({length:65},(_,i)=>({submission_id:String(i+1),creator_id:'11',problem_id:i%2?'102':'101',contest_id:1,run_id:'fixture',code:'int main(){return 0;}\n',code_hash:'a'.repeat(64),review_status:'rule_hit_unreviewed',submitted_at:'2026-09-22T12:00:00Z',result:{label:[],reason:'模拟核查记录'}}));
  const histories=new Map(),queries=[];
  const client={progress:async()=>({runs:[{run_id:'fixture',contest_id:1}]}),search:async(q)=>{queries.push(q);const visible=records.filter(r=>(!q.review_queue_only||r.review_status!=='reviewed_no_ai')&&(!q.review_status||r.review_status===q.review_status));return {reviews:structuredClone(visible.slice(q.offset,q.offset+q.limit)),total:visible.length};},detail:async(id)=>structuredClone(records.find(r=>r.submission_id===id)),feedback:async(id)=>{const latest=histories.get(id);return {latest,history:latest?[latest]:[]};},saveFeedback:async(body)=>{const r=records.find(r=>r.submission_id===body.submission_id);r.review_status=body.status==='ordinary'?'reviewed_no_ai':'reviewed_ai';histories.set(body.submission_id,{...body,id:1,created:1,reviewer_name:'模拟助教'});}};
  const ctx={generation:0,classId:'fixture',className:'测试班',contest:{id:1,problems:[{id:'101',label:'A',title:'第一题'},{id:'102',label:'B',title:'第二题'}]},summary:{rows:[{userId:'11',studentId:'20260001',name:'测试同学',status:'matched'}]}};
  const submissions=records.map(r=>({id:r.submission_id,creator_id:r.creator_id,problem_id:r.problem_id,created_at:r.submitted_at,result:Number(r.submission_id)%2?'WA':'AC',lang:'C',score:0}));submissions.push({...submissions[0],id:'999',creator_id:'22'});
  const panel=createAiReviewPanel(container,{...core,featureClient:()=>client},()=>ctx,null,{loadContestSubmissions:async()=>submissions});
  const find=(text,scope=container)=>[...scope.querySelectorAll('button')].find(b=>b.textContent===text);
  const current=()=>container.querySelector('.ar-review-page');
  const navigate=async(text,id)=>{const b=find(text,current().querySelector('.ar-review-head'));assert(b&&!b.disabled,text+' enabled');b.click();await settle(()=>current()?.querySelector('h2')?.textContent.endsWith('#'+id)&&current().querySelector('textarea')&&!find('下一页',current().querySelector('.ar-review-head')).disabled);};
  await panel.setActive(true);await panel.openDetail('1');
  for(let i=1;i<=30;i++){
    current().querySelector('[aria-label="人工复核结论"]').value='ordinary';current().querySelector('textarea').value='模拟记录：核查为无 AI';await find('保存结论与理由到云端',current()).onclick();assert(!find('下一页',current().querySelector('.ar-review-head')).disabled,'next after save '+i);await navigate('下一页',String(i+1));
  }
  assert(queries.at(-1).offset===0,'refill starts at zero after removing entire page');
  assert(find('上一页',current().querySelector('.ar-review-head')).disabled,'removed records skipped');
  await navigate('下一页','32');await navigate('上一页','31');
  const note=current().querySelector('textarea');note.value='尚未保存的审阅草稿';current().scrollTop=100;const scroll=current().scrollTop;
  find('查看该同学本次比赛提交',current()).click();await settle(()=>current().querySelector('.ar-student-page tbody'));
  const student=current().querySelector('.ar-student-page');assert(student.textContent.includes('共 65 次赛内提交'),'only current student submissions');assert(student.querySelectorAll('tbody tr').length===30,'submission page length');find('下一页',student).click();assert(student.querySelector('.ar-current-submission')?.textContent.includes('31'),'current submission highlighted');
  const filter=student.querySelector('select');filter.value='102';filter.onchange();assert([...student.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('B · 第二题')),'problem filter');assert([...student.querySelectorAll('a')].every(a=>a.target==='_blank'&&a.getAttribute('href').startsWith('/submission/')),'source links');
  find('返回当前核查',student).click();assert(note.value==='尚未保存的审阅草稿'&&current().scrollTop===scroll,'draft and position kept');
  await find('返回列表',current()).onclick();await settle(()=>(!current()||current().hidden)&&container.querySelectorAll('tbody tr').length===30);assert(container.querySelectorAll('tbody tr').length===30,'list refreshed after removed records');assert(container.querySelector('tbody tr').textContent.startsWith('31'),'no AI absent from main queue');
  const problemHost=document.createElement('div');root.append(problemHost);const problemPanel=createAiReviewPanel(problemHost,{...core,featureClient:()=>client},()=>ctx,null,{problemList:true});await problemPanel.setActive(true);await problemPanel.openDetail('1');assert(problemHost.querySelector('[data-review-judgement]').textContent==='已核查为无AI','problem review retains no AI');assert(!find('下一页',problemHost.querySelector('.ar-review-head')).disabled,'problem navigation still available');problemPanel.setActive(false);problemHost.remove();
  await panel.openDetail('31');find('查看该同学本次比赛提交',current()).click();await settle(()=>current().querySelector('.ar-student-page tbody'));
  window.reviewNavigationFixture={panel,root,container,queries};return {passed:true,removedAndNavigated:30,crossPage:true,backward:true,studentRecords:65,problemFilter:true,draftAndScrollPreserved:true,problemListNoAi:true};
})()
