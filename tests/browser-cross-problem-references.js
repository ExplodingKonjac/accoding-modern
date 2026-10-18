(async()=>{
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const settle=async(check,message='history UI did not settle')=>{for(let i=0;i<200;i++){if(check())return;await delay(5);}throw Error(message);};
  const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
  const core=createAiReviewCore();
  const hash=async code=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const currentRun='fixture-current-c4',c3Run='fixture-history-c3',c1Run='fixture-history-c1',creator='920000000001';
  const specs=[
    {id:'910000000001',contest:1315,problem:10399,run:c3Run},
    {id:'910000000002',contest:1299,problem:10256,run:c1Run},
    {id:'910000000003',contest:1315,problem:10399,run:c3Run},
    {id:'910000000004',contest:1299,problem:10256,run:c1Run},
    {id:'910000000005',contest:1315,problem:10399,run:c3Run},
    ...Array.from({length:25},(_,index)=>({id:String(930000000000+index),contest:index%2?1299:1315,problem:index%2?10256:10399,run:index%2?c1Run:c3Run}))
  ];
  for(const [index,item] of specs.entries()){
    item.marker='HISTORY_REFERENCE_'+item.id;
    item.code=`/* ${item.marker} */\nint main(void){return ${index};}\n`;
    item.hash=await hash(item.code);
    item.source={submission_id:item.id,id:item.id,creator_id:creator,contest_id:item.contest,problem_id:item.problem,run_id:item.run,code_hash:item.hash,evaluation_result:'AC',submitted_at:'2026-09-29T10:00:00Z',created_at:'2026-09-29T10:00:00Z'};
  }
  const refs=specs.map(item=>({submission_id:item.id,code_hash:item.hash,contest_id:String(item.contest),problem_id:String(item.problem),source_locator:item.run,role:'baseline'}));
  delete refs[0].problem_id; // The historical problem is unknown until the exact source metadata resolves it.
  delete refs[1].source_locator; // Force anonymous submissionRuns discovery rather than guessing currentRun.
  const currentCode='/* CURRENT_TARGET_ORIGINAL */\nint main(void){return 40;}\n',nextCode='/* CURRENT_TARGET_NEXT */\nint main(void){return 41;}\n';
  const record={submission_id:'900000000001',creator_id:creator,contest_id:1323,problem_id:10709,run_id:currentRun,code:currentCode,code_hash:await hash(currentCode),submitted_at:'2026-10-13T12:00:00Z',evaluation_result:'AC',review_status:'rule_hit_unreviewed',result:{label:['跨题码风变化'],reason:'实际历史来源与内容组对照'},context_references:refs};
  const nextRecord={...record,submission_id:'900000000002',code:nextCode,code_hash:await hash(nextCode),context_references:[]};
  const calls={resolver:[],source:[],runs:[],oj:[],feedback:[],unexpected:[]},oldRead=deferred();
  let badAuthor=true,badCode=true,sessionCalls=0,panel=null;
  const reply=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(body)});
  const transport=async(url,init={})=>{
    assert(!init.headers?.Authorization,'all historical metadata reads must remain anonymous');
    const path=new URL(url).pathname.replace(/^.*\/oj-review-api\/v4/,'');
    let match=path.match(/^\/runs\/([^/]+)\/sources\/(\d+)$/);
    if(match){
      const [,run,id]=match,item=specs.find(source=>source.id===id);calls.source.push({id,run});
      if(!item||run!==item.run)return reply({detail:'strict run and submission binding: not found'},404);
      const source={...item.source};if(id===specs[2].id&&badAuthor)source.creator_id='999999';
      return reply(source);
    }
    match=path.match(/^\/submissions\/(\d+)\/runs$/);
    if(match){
      const id=match[1],item=specs.find(source=>source.id===id);calls.runs.push(id);assert(item,'discovery must concern a historical reference');
      return reply({runs:[
        {run_id:'unpublished-'+id,contest_id:item.contest,created_at:'2026-10-17T00:00:00Z',publication_ready:false,configuration_sha256:'c'.repeat(64)},
        {run_id:item.run,contest_id:item.contest,created_at:'2026-10-16T12:00:00Z',publication_ready:true,configuration_sha256:'b'.repeat(64)}
      ]});
    }
    calls.unexpected.push(path);throw Error('unexpected historical request: '+path);
  };
  // Use the actual core resolver and its identity checks; the fake transport is strict about run+sid.
  // The fixture itself does not cache metadata or OJ source responses.
  const historicalClient=core.featureClient(()=>{throw Error('anonymous resolver must not inspect writer credentials');},transport,4);
  assert(typeof historicalClient.referenceSource==='function','featureClient.referenceSource(ref,currentRecord,signal) is required');
  const client={
    progress:async()=>({runs:[{run_id:currentRun,contest_id:1323,publication_ready:true}]}),
    search:async()=>({reviews:[structuredClone(record),structuredClone(nextRecord)],total:2}),
    detail:async id=>structuredClone(String(id)===record.submission_id?record:nextRecord),
    source:(...args)=>historicalClient.source(...args),
    referenceSource:(ref,current,signal)=>{calls.resolver.push(String(ref.submission_id));assert(String(current.creator_id)===creator,'resolver inherits the verified current author');return historicalClient.referenceSource(ref,current,signal);},
    submissionRuns:(...args)=>historicalClient.submissionRuns(...args),
    feedback:async id=>{calls.feedback.push(String(id));return {latest:null,history:[]};},
    profile:async()=>({profile:{creator_id:creator,summary:{coverage:{contest_ids:[1299,1315,1323],source_count:100}},evidence:[]},status:'current',scores_valid:true,scope_contest_ids:[1299,1315,1323]}),
    session:async()=>{sessionCalls++;throw Error('reading comparisons must not check write identity');}
  };
  const nativeFetch=window.fetch;
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input.url,path=new URL(url,location.href).pathname,match=path.match(/^\/submission\/(\d+)$/);
    if(!match){calls.unexpected.push(path);throw Error('unexpected OJ request: '+path);}
    const id=match[1],item=specs.find(source=>source.id===id);assert(item,'current code is already available and should not be fetched again');calls.oj.push(id);
    if(id===specs[4].id)await oldRead.promise; // Intentionally ignore abort to exercise the UI generation guard.
    const code=id===specs[3].id&&badCode?'/* HASH_MISMATCH_MUST_NOT_DISPLAY */\nint main(){return 999;}\n':item.code;
    return {ok:true,status:200,text:async()=>'<pre><code>'+code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</code></pre>'};
  };
  document.body.replaceChildren();document.title='跨比赛历史对照按需读取验收';
  const host=document.createElement('main');document.body.append(host);
  const context={generation:0,classId:'fixture',className:'测试班',contest:{id:1323,title:'程序设计基础 C4',problems:[{id:10709,label:'A',title:'麦旋风'}]},summary:{rows:[{userId:creator,studentId:'20260001',name:'测试同学',status:'matched'}]}};
  const current=()=>host.querySelector('.ar-review-page'),comparison=()=>current()?.querySelector('details[data-history-comparison]'),view=()=>comparison()?.querySelector('[data-history-view]');
  const find=(text,scope=comparison())=>[...(scope?.querySelectorAll('button')||[])].find(button=>button.textContent.trim()===text);
  const count=()=>({resolver:calls.resolver.length,source:calls.source.length,runs:calls.runs.length,oj:calls.oj.length});
  const unchanged=(before,message)=>assert(JSON.stringify(before)===JSON.stringify(count()),message);
  const loaded=async item=>{await settle(()=>view()?.textContent.includes(item.marker),'selected historical code did not load: '+item.id);const selected=comparison().dataset.historySubmission||view().dataset.historySubmission||comparison().querySelector('[data-history-submission]')?.dataset.historySubmission;assert(String(selected)===item.id,'historical view binds its selected submission identity');};
  const step=async(text,item)=>{const button=find(text);assert(button&&!button.disabled,text+' must be available');button.click();await loaded(item);};
  try{
    panel=createAiReviewPanel(host,{...core,featureClient:()=>client},()=>context);
    await panel.setActive(true);await panel.openDetail(record.submission_id);
    assert(refs.length===30&&comparison()&&comparison().open,'cross-contest comparison opens by default');
    await loaded(specs[0]);assert(calls.oj.length===1,'only the first selected comparison loads by default');
    assert(!current().innerText.includes('读取失败')&&!current().innerText.includes('404'),'collapsed history has no error flood');
    const note=current().querySelector('textarea'),mark=current().querySelector('[aria-label="人工复核结论"]');assert(note&&mark,'manual editor is ready independently of history');note.value='历史对照未读取也能填写的草稿';mark.value='uncertain';
    assert(current().textContent.includes('CURRENT_TARGET_ORIGINAL'),'current source is visible before expanding history');
    await loaded(specs[0]);
    assert(calls.source.some(call=>call.id===specs[0].id&&call.run===c3Run),'first reference uses its explicit C3 source locator');
    assert(view().textContent.includes(String(specs[0].problem)),'missing reference problem ID is filled by the exact historical metadata');
    assert(!calls.oj.includes(specs[1].id),'expanding does not prefetch the second reference');
    await step('下一份对照',specs[1]);
    assert(calls.runs.includes(specs[1].id)&&calls.source.some(call=>call.id===specs[1].id&&call.run===c1Run),'second reference discovers the complete C1 run');
    assert(calls.source.every(call=>call.run!==currentRun),'cross-contest references are never queried against the current C4 run');
    assert(calls.oj.filter(id=>id===specs[0].id).length===1&&calls.oj.filter(id=>id===specs[1].id).length===1,'one OJ read per selected valid reference');
    const cached=count();await step('上一份对照',specs[0]);unchanged(cached,'returning to a successful reference reuses metadata and verified code');
    comparison().querySelector('summary').click();await delay(10);unchanged(cached,'collapsing history issues no new requests');
    comparison().querySelector('summary').click();await loaded(specs[0]);unchanged(cached,'reopening the same comparison reuses the successful snapshot');
    await step('下一份对照',specs[1]);unchanged(cached,'forward navigation also reuses the already loaded reference');
    find('下一份对照').click();await settle(()=>find('重试'),'author mismatch should expose one local retry');
    assert(!calls.oj.includes(specs[2].id),'wrong-author metadata is rejected before OJ source is requested');
    assert(comparison().querySelectorAll('button').length<=4&&comparison().querySelectorAll('button').length>0&&comparison().querySelectorAll('button').length===new Set([...comparison().querySelectorAll('button')].map(button=>button.textContent)).size,'a single failed reference produces no repeated controls or error flood');
    assert(current().textContent.includes('CURRENT_TARGET_ORIGINAL')&&current().querySelector('textarea')===note&&note.value==='历史对照未读取也能填写的草稿','current code and editor survive reference failure');
    const feedbackBefore=calls.feedback.length;find('刷新云端历史',current()).click();await settle(()=>calls.feedback.length===feedbackBefore+1);assert(note.value==='历史对照未读取也能填写的草稿'&&mark.value==='uncertain','fresh manual feedback remains available without replacing the draft');
    badAuthor=false;find('重试').click();await loaded(specs[2]);
    find('下一份对照').click();await settle(()=>find('重试'),'wrong OJ source hash should expose a local retry');
    assert(!view().textContent.includes('HASH_MISMATCH_MUST_NOT_DISPLAY'),'unverified source text is never displayed');
    const failedCodeReads=calls.oj.filter(id=>id===specs[3].id).length;assert(failedCodeReads===1,'a failed source is not automatically retried in a loop');
    badCode=false;find('重试').click();await loaded(specs[3]);assert(calls.oj.filter(id=>id===specs[3].id).length===2,'retry refetches a failed hash instead of caching it');
    find('下一份对照').click();await settle(()=>calls.oj.includes(specs[4].id),'old selected history request should be pending');
    await panel.openDetail(nextRecord.submission_id);const newNote=current().querySelector('textarea');assert(newNote,'next submission editor is immediately available');newNote.value='切换提交后的新草稿';
    oldRead.resolve();await delay(25);
    assert(current().textContent.includes('CURRENT_TARGET_NEXT')&&!current().textContent.includes(specs[4].marker),'an old reference response cannot fill the next submission');
    assert(current().querySelector('textarea')===newNote&&newNote.value==='切换提交后的新草稿','late historical response preserves the new editor and draft');
    assert(specs.slice(5).every(item=>!calls.resolver.includes(item.id)&&!calls.oj.includes(item.id)),'the other twenty-five references are never eagerly resolved or read');
    assert(sessionCalls===0&&calls.unexpected.length===0,'reference reads never request write identity or unrelated endpoints');
    return {passed:true,synthetic:true,referenceCount:30,initialHistoryRequests:1,firstReferenceRun:c3Run,secondReferenceRun:c1Run,missingProblemResolved:true,strictAuthorBinding:true,hashMismatchRejected:true,lazyNavigation:true,successfulCacheReused:true,localFailureRetry:true,currentCodeAndDraftPreserved:true,feedbackFresh:true,staleResponseIgnored:true,sessionRequests:sessionCalls};
  }finally{oldRead.resolve();panel?.setActive(false);window.fetch=nativeFetch;}
})()
