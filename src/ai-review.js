function createAiReviewPanel(container,core,getContext,_readMetadata,options={}) {
  const noteKey='accoding-modern.ai-review.notes.v1',tokenKey='accoding-modern.ai-review.reviewer.v1';
  let generation=0,controller=null,timer=null,rows=[],page=0,total=0,active=false,detailVersion=0,detailController=null,runs=[],runId='';
  const getToken=()=>localStorage.getItem(tokenKey)||'';
  const client=core.featureClient(getToken,fetch,4),size=30;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);return n;};
  const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
  const refill=(s,values,keep=s.value)=>{s.replaceChildren();for(const [value,text] of values){const o=el('option',text);o.value=value;s.append(o);}if([...s.options].some(o=>o.value===keep))s.value=keep;};
  const select=(name,values)=>{const s=el('select');s.setAttribute('aria-label',name);refill(s,values);s.onchange=()=>{page=0;void reload();};return s;};
  const labels={suspected:'有AI嫌疑',ordinary:'无AI嫌疑'};
  const problem=select('复核题目',[['all','全部题目']]);
  const feature=select('代码特征',[['all','全部特征'],...core.featureLabels.map(x=>[x,x])]);
  const message=el('p','读取比赛后，打开代码复核。');message.setAttribute('role','status');
  const progress=el('p');progress.setAttribute('aria-live','polite');
  const list=el('div');list.className='table-wrap';const pager=el('div');pager.className='pager';const detail=el('section');detail.className='panel';detail.hidden=true;
  const style=el('style');style.textContent=`.ar-toolbar,.ar-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.ar-toolbar select{min-width:140px;flex:1}.ar-actions button{min-height:38px}.ar-auth{padding:12px;border:1px solid #dce3ed;border-radius:10px;margin:12px 0}.ar-auth input{min-width:200px;flex:1}.ar-note{display:block;width:100%;min-height:100px;padding:12px;border:1px solid #ccd9e9;border-radius:8px;box-sizing:border-box;font:inherit}.ar-source,.ar-diff{font:13px/1.65 ui-monospace,monospace;overflow:auto;max-height:540px;background:#f7f9fc;padding:12px;border:1px solid #dce3ed;border-radius:8px}.ar-diff{padding:0;white-space:pre}.ar-diff-line{display:block;min-width:max-content;padding:0 12px}.ar-diff-line.remove{background:#ffebe9;color:#82071e}.ar-diff-line.add{background:#dafbe1;color:#116329}.ar-diff-line.equal{background:#fff;color:#334155}.ar-history{border-left:3px solid #d7e3f7;padding:10px 14px;margin:12px 0}.ar-close{float:right} .ar-table td{white-space:normal;min-width:90px}.ar-table td:last-child{white-space:nowrap}@media(max-width:650px){.ar-toolbar>*{flex:1 1 150px}.ar-actions>*{flex:1}.ar-source{font-size:12px}}`;
  const controls=el('div');controls.className='ar-toolbar';controls.append(problem,feature);
  const actions=el('div');actions.className='ar-actions';actions.append(button('刷新云端结果',()=>void reload()),button('导出当前结果',()=>void exportRows()));
  const sidInput=el('input');sidInput.placeholder='提交 ID（含规则未命中）';sidInput.inputMode='numeric';sidInput.setAttribute('aria-label','复核提交 ID');
  actions.append(sidInput,button('查看提交',()=>{if(/^[1-9]\d*$/.test(sidInput.value.trim()))void openDetail(sidInput.value.trim());else message.textContent='请输入有效的提交 ID。';}));
  const auth=el('details');auth.className='ar-auth';auth.append(el('summary','助教云端同步设置'));
  const token=el('input');token.type='password';token.autocomplete='off';token.placeholder='填写助教同步密钥';token.setAttribute('aria-label','助教同步密钥');
  const authStatus=el('p',getToken()?'已保存同步密钥，人工反馈将从云端读取。':'查看、修改人工结论前，请填写由核查系统签发的助教同步密钥。');
  const authActions=el('div');authActions.className='ar-actions';authActions.append(token,button('连接并保存',async()=>{const proposed=token.value.trim();if(!proposed){authStatus.textContent='请填写同步密钥。';return;}try{const reader=core.featureClient(()=>proposed,fetch,4),who=await reader.session();localStorage.setItem(tokenKey,proposed);token.value='';authStatus.textContent=`已连接：${who.display_name} · 人工反馈自动同步`;void reload();}catch(e){authStatus.textContent=e.message;}}),button('退出同步',()=>{localStorage.removeItem(tokenKey);authStatus.textContent='已退出助教同步。';void reload();}));auth.append(authActions,authStatus);
  container.append(style,el('h2','代码复核'),controls,actions,auth,message,progress,list,pager,detail);
  if(options.submissionId){controls.hidden=actions.hidden=message.hidden=list.hidden=pager.hidden=true;}
  function contextKey(){const c=getContext();return `${c.classId||''}:${c.contest?.id||''}:${c.generation}`;}
  function key(){return contextKey()+':v4:'+runId;}
  function reload(){return options.submissionId?openDetail(options.submissionId):refresh();}
  function stop(){generation++;controller?.abort();detailVersion++;detailController?.abort();clearTimeout(timer);}
  function reset(){stop();rows=[];runs=[];total=page=0;runId='';detail.hidden=true;detail.replaceChildren();progress.textContent='';message.textContent='读取比赛后，打开代码复核。';draw();}
  function query(c,offset=page*size,limit=size){return {contest_id:Number(c.contest.id),creator_ids:[...core.members(c.summary.rows).keys()],offset,limit,run_id:runId,...(problem.value==='all'?{}:{problem_id:Number(problem.value)}),...(feature.value==='all'?{}:{label:feature.value})};}
  function fillRuns(values){runs=[...values].sort((a,b)=>(Number(b.created_at)||0)-(Number(a.created_at)||0)||b.run_id.localeCompare(a.run_id));const latest=runs[0]?.run_id||'';if(latest!==runId)page=0;runId=latest;}
  function showProgress(b){progress.textContent=b?(b.backend_kind==='rules_engine'?`全量规则 · 每人每题最新 1 份，每人最多 8 份 · ${b.screening?.complete?'已同步':'同步中'}`:`历史核查运行 · ${core.states[b.state]||b.state}`):'尚无已同步的核查运行。';}
  async function refresh(){
    stop();const v=generation,k=contextKey(),c=getContext();detail.hidden=true;detail.replaceChildren();
    if(!active||!c.contest||!c.summary){message.textContent='请先读取比赛和榜单。';return;}
    refill(problem,[['all','全部题目'],...c.contest.problems.map(p=>[String(p.id),`${p.label} · ${p.title}`])]);
    const current=new AbortController();controller=current;const timeout=setTimeout(()=>current.abort(),20000);
    rows=[];total=0;draw();message.textContent='正在读取云端复核记录…';
    try{
      const state=await client.progress(c.contest.id,current.signal);if(v!==generation||k!==contextKey())return;
      fillRuns(state.runs);showProgress(runs[0]);if(!runId){message.textContent='尚无核查结果，请先在核查系统发布比赛。';return;}
      const requestKey=key(),result=await client.search(query(c),current.signal);if(v!==generation||requestKey!==key())return;
      const memberMap=core.members(c.summary.rows);rows=result.reviews.map(r=>({...r,member:memberMap.get(String(r.creator_id))}));total=result.total;
      if(total&&page*size>=total){page=Math.floor((total-1)/size);void refresh();return;}
      message.textContent=`${c.className} · ${total} 条${getToken()?' · 已同步助教结论':' · 连接助教同步后可查看人工修改'}`;draw();
    }catch(e){if(v===generation){rows=[];total=0;draw();message.textContent=e.name==='AbortError'?'读取超时，请刷新重试。':e.message;}}
    finally{clearTimeout(timeout);if(controller===current)controller=null;}
  }
  function judgement(r){return r.annotation?labels[r.annotation.status]:(r.result?.ai_suspected===false||r.decision_kind==='unflagged'?'无AI嫌疑':'有AI嫌疑');}
  function draw(){
    const table=el('table');table.className='ar-table';const thead=el('thead'),head=el('tr');['提交','学生','题目','提交时间','当前结论','依据','详情'].forEach(t=>head.append(el('th',t)));thead.append(head);table.append(thead);
    const body=el('tbody');for(const r of rows){const p=getContext().contest?.problems.find(p=>String(p.id)===String(r.problem_id)),tr=el('tr');
      for(const text of [r.submission_id,`${r.member?.name||r.creator_id} · ${r.member?.studentId||''}`,p?`${p.label} · ${p.title}`:r.problem_id,new Date(r.submitted_at).toLocaleString(),judgement(r),r.annotation?r.annotation.reason:(r.result?.label||r.labels||[]).join('；')])tr.append(el('td',text));
      const td=el('td');td.append(button('查看 / 修改',()=>void openDetail(r.submission_id)));tr.append(td);body.append(tr);}
    table.append(body);list.replaceChildren(table);pager.replaceChildren(el('span',`共 ${total} 条 · ${page+1} / ${Math.max(1,Math.ceil(total/size))}`));
    const previous=button('上一页',()=>{page--;void refresh();}),next=button('下一页',()=>{page++;void refresh();});previous.disabled=page<=0;next.disabled=(page+1)*size>=total;pager.append(previous,next);
  }
  const pre=text=>{const p=el('pre',text);p.className='ar-source';return p;};
  function diff(before,after){const box=el('pre');box.className='ar-diff';box.setAttribute('aria-label','前后版本逐行差异');for(const line of core.lineDiff(before,after)){const n=el('span',`${String(line.oldLine??'').padStart(4)} ${String(line.newLine??'').padStart(4)} ${line.kind==='add'?'+':line.kind==='remove'?'-':' '} ${line.text}\n`);n.className='ar-diff-line '+line.kind;box.append(n);}return box;}
  async function readOj(id,hash,signal){const res=await fetch(`/submission/${id}`,{credentials:'same-origin',cache:'no-store',signal});if(!res.ok)throw Error('OJ 源码读取失败');const node=new DOMParser().parseFromString(await res.text(),'text/html').querySelector('pre code');if(!node)throw Error('OJ 未返回源码，请先登录 OJ。');return core.sourceFromOj(node.textContent,id,hash);}
  async function openDetail(id){
    clearTimeout(timer);const n=++detailVersion,base=contextKey();detail.hidden=false;detail.replaceChildren(el('p','正在读取复核详情…'));detailController?.abort();
    const c=new AbortController(),timeout=setTimeout(()=>c.abort(),20000);detailController=c;
    const valid=()=>n===detailVersion&&base===contextKey();
    try{
      if(options.submissionId||!runId){const state=await client.submissionRuns(String(id),c.signal);if(!valid())return;fillRuns(state.runs);showProgress(runs[0]);}
      let r=runId?await client.detail(String(id),runId,c.signal):null;if(!valid())return;
      if(!r&&runId&&getToken()){const source=await client.source(String(id),runId,c.signal);r={...source,run_id:runId,decision_kind:'unflagged',result:{label:[],reason:'未列入规则嫌疑清单；可修改结论并填写理由。'},evidence:[],code:await readOj(id,source.code_hash,c.signal)};}
      if(!valid())return;
      if(r&&!options.submissionId){const ctx=getContext();if(r.contest_id!==Number(ctx.contest.id)||!core.members(ctx.summary.rows).has(String(r.creator_id)))throw Error('详情与当前班级不一致');}
      const close=button('收起详情',()=>{detailVersion++;c.abort();detail.hidden=true;});close.className='ar-close';detail.replaceChildren(close,el('h3',`提交 ${id}`));
      if(!r){detail.append(el('p','尚无可用结果。请连接助教云端同步，并在核查系统发布此比赛的源码清单，即可补报规则未命中的提交。'));return;}
      const judgementLabel=el('p',judgement(r));judgementLabel.dataset.reviewJudgement='1';detail.append(judgementLabel,el('p','原始依据：'+r.result.reason),el('p','原始特征：'+(r.result.label||[]).join('；')),el('h3','本提交源码'),pre(r.code.split('\n').map((line,i)=>`${i+1}  ${line}`).join('\n')));
      for(const ref of [...new Map((r.context_references||[]).map(x=>[x.submission_id,x])).values()]){
        const word=ref.relation==='later'?'后版':'前版',a=el('a',`在 OJ 打开${word} ${ref.submission_id}`);a.href=`/submission/${ref.submission_id}`;a.target='_blank';a.rel='noopener';const comparison=el('section');
        const load=button(`查看与${word}的差异`,async()=>{load.disabled=true;comparison.replaceChildren(el('p','正在加载并核对源码…'));const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),15000),cancel=()=>abort.abort();c.signal.addEventListener('abort',cancel,{once:true});try{const source=await readOj(ref.submission_id,ref.code_hash,abort.signal);if(!valid())return;comparison.replaceChildren(el('h3',`${word} ${ref.submission_id} · 红色为删除，绿色为新增`),ref.relation==='later'?diff(r.code,source):diff(source,r.code));}catch(e){if(valid())comparison.replaceChildren(el('p',e.message));}finally{clearTimeout(deadline);c.signal.removeEventListener('abort',cancel);load.disabled=false;}});
        const bar=el('div');bar.className='ar-actions';bar.append(load,a);detail.append(bar,comparison);
      }
      for(const e of r.evidence||[])detail.append(el('h3',`证据 · 第 ${e.start_line}–${e.end_line} 行`),pre(e.quote));
      detail.append(el('p',`源码校验：${r.code_hash}`));
      if(getToken())await feedbackEditor(r,c.signal,valid);else detail.append(el('p','在“助教云端同步设置”连接后，可修改结论并填写理由。'));
      if(valid())detail.scrollIntoView({block:'start',behavior:'smooth'});
    }catch(e){if(valid())detail.replaceChildren(el('p',e.name==='AbortError'?'读取超时，请重试。':e.message));}finally{clearTimeout(timeout);}
  }
  async function feedbackEditor(r,signal,valid){
    let history=await client.feedback(r.submission_id,r.code_hash,r.run_id,signal);if(!valid())return;
    const mark=el('select');mark.setAttribute('aria-label','人工复核结论');refill(mark,Object.entries(labels));
    const note=el('textarea');note.className='ar-note';note.placeholder='请说明更正或补报的理由，供其他助教及后续规则优化参考。';note.maxLength=3000;note.setAttribute('aria-label','人工复核理由');
    if(history.latest){mark.value=history.latest.status;note.value=history.latest.reason;}else{mark.value=r.annotation?.status||(r.decision_kind==='unflagged'?'ordinary':'suspected');try{const notes=JSON.parse(localStorage.getItem(noteKey)||'{}'),old=notes[r.run_id+':'+r.submission_id+':'+r.code_hash]||notes[r.submission_id+':'+r.code_hash];if(old){mark.value=({retained:'suspected',ordinary:'ordinary'})[old.status]||mark.value;note.value=old.note||'';}}catch{}}
    const status=el('p'),historyBox=el('div'),bar=el('div');bar.className='ar-actions';let pending=null;
    function drawHistory(){historyBox.replaceChildren();for(const h of history.history){const item=el('div');item.className='ar-history';item.append(el('strong',`${h.reviewer_name} · ${labels[h.status]} · ${new Date(h.created*1000).toLocaleString()}`),el('p',h.reason));historyBox.append(item);}if(!history.history.length)historyBox.append(el('p','暂无云端人工记录。'));}
    const save=button('保存结论与理由到云端',async()=>{if(!note.value.trim()){status.textContent='请填写理由后保存。';note.focus();return;}save.disabled=true;const body={submission_id:r.submission_id,code_hash:r.code_hash,run_id:r.run_id,status:mark.value,reason:note.value.trim(),code:r.code,base_revision:history.latest?.id||0};const signature=JSON.stringify(body);if(pending?.signature!==signature)pending={signature,request_id:crypto.randomUUID()};try{await client.saveFeedback({...body,request_id:pending.request_id},AbortSignal.timeout(20000));if(!valid())return;history=await client.feedback(r.submission_id,r.code_hash,r.run_id,AbortSignal.timeout(15000));if(!valid())return;pending=null;r.annotation=history.latest;const row=rows.find(x=>x.submission_id===r.submission_id&&x.code_hash===r.code_hash);if(row)row.annotation=history.latest;draw();const label=detail.querySelector('[data-review-judgement]');if(label)label.textContent=judgement(r);drawHistory();status.textContent='已保存到云端，其他助教刷新后即可查看。';}catch(e){if(valid())status.textContent=e.message+'；草稿已保留，可重试或先刷新历史。';}finally{save.disabled=false;}});save.className='primary';
    bar.append(mark,save,button('刷新云端历史',async()=>{try{history=await client.feedback(r.submission_id,r.code_hash,r.run_id,AbortSignal.timeout(15000));if(valid()){drawHistory();status.textContent='已刷新历史；当前理由草稿保留，请核对后再保存。';}}catch(e){if(valid())status.textContent=e.message;}}));
    detail.append(el('h3','助教复核'),note,bar,status,el('h3','云端修改历史'),historyBox);drawHistory();
  }
  async function exportRows(){
    const c=getContext(),k=key();if(!c.contest||!c.summary||!runId)return;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),60000);
    try{const all=[];let expected=Infinity;for(let offset=0;offset<expected;offset+=100){const r=await client.search(query(c,offset,100),abort.signal);if(k!==key())return;expected=r.total;all.push(...r.reviews);if(!r.reviews.length)break;}
      const feedback=[];if(getToken()){let after=0;while(true){const packet=await client.exportFeedback(c.contest.id,after,abort.signal);if(k!==key())return;feedback.push(...packet.feedback);if(!packet.feedback.length)break;after=packet.next_after;}}
      const memberMap=core.members(c.summary.rows),payload={exported_at:new Date().toISOString(),class_name:c.className,run_id:runId,reviews:all.map(r=>({name:memberMap.get(String(r.creator_id))?.name,student_id:memberMap.get(String(r.creator_id))?.studentId,review:r})),feedback};
      const link=el('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));link.href=url;link.download='代码复核与助教反馈.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){message.textContent='导出失败：'+e.message;}finally{clearTimeout(timeout);}
  }
  return {reset,openDetail,setActive(value){active=value;if(value)void refresh();else stop();}};
}
function mountSubmissionReview(core){
  let current='',panel=null,host=null;
  const sync=()=>{
    const match=location.pathname.match(/^\/submission\/(\d+)(?:\/|$)/),id=match?.[1]||'';
    if(id===current)return;current=id;panel?.reset();host?.remove();host=null;if(!id)return;
    host=document.createElement('div');host.id='am-submission-review';document.body.append(host);const root=host.attachShadow({mode:'open'});
    root.innerHTML='<style>:host{font:14px/1.6 system-ui;color:#25344b}button,input,select,textarea{font:inherit;padding:7px;border:1px solid #cdd8e8;border-radius:7px;background:white;color:inherit}button{cursor:pointer}#launch{position:fixed;right:26px;bottom:150px;z-index:9999}#drawer{position:fixed;inset:40px 20px 20px auto;width:min(740px,90vw);overflow:auto;background:#fff;padding:20px;box-shadow:0 5px 50px #17253a55;z-index:2147483001} [hidden]{display:none!important}.row{display:flex;gap:8px;flex-wrap:wrap}.row select{max-width:100%;box-sizing:border-box}table{font-size:12px}textarea{box-sizing:border-box}pre{font:13px/1.5 monospace}</style><button id="launch">代码复核</button><section id="drawer" hidden><button id="close">收起</button><div id="content"></div></section>';
    panel=createAiReviewPanel(root.querySelector('#content'),core,()=>({generation:id}),async()=>[],{submissionId:id});
    root.querySelector('#launch').onclick=()=>{root.querySelector('#drawer').hidden=false;void panel.openDetail(id);};
    root.querySelector('#close').onclick=()=>{root.querySelector('#drawer').hidden=true;panel.reset();};
  };
  sync();window.addEventListener('popstate',sync);new MutationObserver(sync).observe(document.body,{childList:true});
}
