function createAiReviewPanel(container,core,getContext,_readMetadata,options={}) {
  const noteKey='accoding-modern.ai-review.notes.v1';
  let generation=0,controller=null,timer=null,rows=[],page=0,total=0,active=false,detailVersion=0,detailController=null,runs=[],runId='';
  const apiFeatures=core.featureClient(()=>'',fetch,4),size=30;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);return n;};
  const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
  const refill=(s,values,keep=s.value)=>{s.replaceChildren();for(const [value,text] of values){const o=el('option',text);o.value=value;s.append(o);}if([...s.options].some(o=>o.value===keep))s.value=keep;};
  const select=(name,values)=>{const s=el('select');s.setAttribute('aria-label',name);refill(s,values);s.onchange=()=>{page=0;void reload();};return s;};
  const problem=select('复核题目',[['all','全部题目']]);
  const feature=select('代码特征',[['all','全部特征'],...core.featureLabels.map(x=>[x,x])]);
  const selection=select('复核来源',[['all','全部复核来源'],...Object.entries(core.selections)]);
  const message=el('p','读取比赛后，打开代码复核。');message.setAttribute('role','status');
  const progress=el('p');progress.setAttribute('aria-live','polite');
  const list=el('div');list.className='table-wrap';const pager=el('div');pager.className='pager';const detail=el('section');detail.className='panel';detail.hidden=true;
  const controls=el('div');controls.className='row';controls.append(problem,button('刷新结果',()=>void reload()),button('导出当前结果',()=>void exportRows()));
  container.append(el('h2','AI 嫌疑代码'),controls,message,progress,list,pager,detail);
  if(options.submissionId){message.hidden=problem.hidden=feature.hidden=selection.hidden=list.hidden=pager.hidden=true;controls.lastChild.hidden=true;}
  function client(){return apiFeatures;}
  function contextKey(){const c=getContext();return `${c.classId||''}:${c.contest?.id||''}:${c.generation}`;}
  function key(){return contextKey()+':v4:'+runId;}
  function reload(){return options.submissionId?openDetail(options.submissionId):refresh();}
  function stop(){generation++;controller?.abort();detailVersion++;detailController?.abort();clearTimeout(timer);}
  function reset(){stop();rows=[];runs=[];total=page=0;runId='';detail.hidden=true;detail.replaceChildren();progress.textContent='';message.textContent='读取比赛后，打开代码复核。';draw();}
  function query(c,offset=page*size,limit=size){return {contest_id:Number(c.contest.id),creator_ids:[...core.members(c.summary.rows).keys()],offset,limit,run_id:runId,...(problem.value==='all'?{}:{problem_id:Number(problem.value)}),...(feature.value==='all'?{}:{label:feature.value}),...(selection.value==='all'?{}:{selection:selection.value})};}
  function fillRuns(values){runs=[...values].sort((a,b)=>(Number(b.created_at)||0)-(Number(a.created_at)||0)||b.run_id.localeCompare(a.run_id));const latest=runs[0]?.run_id||'';if(latest!==runId)page=0;runId=latest;}
  function showProgress(b){progress.hidden=Boolean(b?.screening);if(b?.screening){progress.textContent='';return;}progress.textContent=b?`${core.states[b.state]||b.state} · ${b.requested_model||b.model_name||''}${b.requested_thinking_level?' / '+b.requested_thinking_level:''}${b.policy_version==='feature-presence-if-only-v2'?' · 输入防护仅限 if，排除 while 输入循环':''} · 已完成 ${b.completed} / ${b.selected} · 命中特征 ${b.suspected} · 未命中 ${b.negative} · 失败 ${b.failed} · 待处理 ${b.pending}${b.reported_at?' · 上次报告 '+new Date(b.reported_at*1000).toLocaleString():''}${b.state==='running'&&b.reported_at&&Date.now()/1000-b.reported_at>300?'（进度超过 5 分钟未更新）':''}`:options.submissionId?'此提交尚无已发布的当前方案命中结果。':'尚无当前方案核查运行。';}
  async function refresh(){
    stop();const v=generation,k=contextKey(),c=getContext();detail.hidden=true;detail.replaceChildren();
    if(!active||!c.contest||!c.summary){message.textContent='请先读取比赛和榜单，再查看当前班级的代码复核。';return;}
    refill(problem,[['all','全部题目'],...c.contest.problems.map(p=>[String(p.id),`${p.label} · ${p.title}`])]);
    const current=new AbortController();controller=current;const timeout=setTimeout(()=>current.abort(),20000);
    rows=[];total=0;draw();message.textContent='正在读取当前班级的特征核查结果…';progress.textContent='';
    try{
      const state=await client().progress(c.contest.id,current.signal);if(v!==generation||k!==contextKey())return;
      fillRuns(state.runs);const selected=runs[0];showProgress(selected);if(!selected){message.textContent='尚无 API Agent 核查结果。';return;}
      const requestKey=key(),result=await client().search(query(c),current.signal);if(v!==generation||requestKey!==key())return;
      const memberMap=core.members(c.summary.rows);rows=result.reviews.map(r=>({...r,member:memberMap.get(String(r.creator_id))}));total=result.total;
      if(!total)page=0;if(total&&page*size>=total){page=Math.floor((total-1)/size);void refresh();return;}
      message.textContent=`${c.className} · 命中约定代码特征 ${total} 条提交。`;
      draw();if(selected?.state==='running')timer=setTimeout(()=>void refresh(),30000);
    }catch(e){if(v===generation){rows=[];total=0;draw();message.textContent=e.name==='AbortError'?'读取超时，请刷新重试。':e.message;}}
    finally{clearTimeout(timeout);if(controller===current)controller=null;}
  }
  function draw(){
    const table=el('table'),thead=el('thead'),head=el('tr');['提交','学生','题目','提交时间','判断','可疑特征','详情'].forEach(t=>head.append(el('th',t)));thead.append(head);table.append(thead);
    const body=el('tbody');for(const r of rows){
      const p=getContext().contest?.problems.find(p=>String(p.id)===String(r.problem_id)),tr=el('tr');
      for(const text of [r.submission_id,`${r.member.name} · ${r.member.studentId}`,p?`${p.label} · ${p.title}`:r.problem_id,new Date(r.submitted_at).toLocaleString(),'有 AI 嫌疑',(r.result?.label||r.labels).join('；')||'可疑代码'])tr.append(el('td',text));
      const td=el('td');td.append(button('查看复核',()=>void openDetail(r.submission_id)));tr.append(td);body.append(tr);
    }
    table.append(body);list.replaceChildren(table);pager.replaceChildren(el('span',`共 ${total} 条 · ${page+1} / ${Math.max(1,Math.ceil(total/size))}`));
    const previous=button('上一页',()=>{page--;void refresh();}),next=button('下一页',()=>{page++;void refresh();});previous.disabled=page<=0;next.disabled=(page+1)*size>=total;pager.append(previous,next);
  }
  async function openDetail(id){
    const n=++detailVersion,base=contextKey();let k=key();detail.hidden=false;detail.replaceChildren(el('p','正在读取复核详情…'));
    detailController?.abort();const c=new AbortController(),timeout=setTimeout(()=>c.abort(),20000);detailController=c;
    try{
      if(options.submissionId){const state=await client().submissionRuns(String(id),c.signal);if(n!==detailVersion||base!==contextKey())return;fillRuns(state.runs);k=key();showProgress(runs.find(x=>x.run_id===runId));}
      const r=runId?await client().detail(String(id),runId,c.signal):null;
      if(n!==detailVersion||k!==key())return;
      if(r&&!options.submissionId){const ctx=getContext();if(r.contest_id!==Number(ctx.contest.id)||!core.members(ctx.summary.rows).has(String(r.creator_id)))throw new Error('详情与当前班级不一致');}
      detail.replaceChildren(button('收起详情',()=>{detailVersion++;c.abort();detail.hidden=true;}),el('h3',`提交 ${id}`));
      if(!r){detail.append(el('p','所选方案暂无此提交的命中特征结果；未展示不代表已判定为 false。'));return;}
      const pre=text=>{const p=el('pre',text);p.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7fb;padding:14px;max-height:500px;overflow:auto';return p;};
      detail.append(el('p','有 AI 嫌疑'),el('p','可疑特征：'+(r.result?.label||r.labels).join('；')),el('p','可疑原因：'+(r.result?.reason||r.explanation)),el('h3','本提交源码'),pre(r.code.split('\n').map((line,i)=>`${i+1}  ${line}`).join('\n')));
      const references=r.context_references|| (r.previous_submission_id?[{submission_id:r.previous_submission_id,relation:'earlier'}]:[]);
      const unique=[...new Map(references.map(x=>[x.submission_id,x])).values()];
      for(const ref of unique){
        const word=ref.relation==='later'?'后版':'前版',a=el('a',`在 OJ 打开${word}提交 ${ref.submission_id}`);a.href=`/submission/${ref.submission_id}`;a.target='_blank';a.rel='noopener';
        const comparison=el('section');comparison.hidden=true;
        const load=button(`从 OJ 加载${word}源码`,async()=>{
          load.disabled=true;comparison.hidden=false;comparison.replaceChildren(el('p','正在从 OJ 读取源码…'));
          const abort=new AbortController(),cancel=()=>abort.abort(),deadline=setTimeout(cancel,15000);c.signal.addEventListener('abort',cancel,{once:true});if(c.signal.aborted)cancel();
          try{const res=await fetch(`/submission/${ref.submission_id}`,{credentials:'same-origin',cache:'no-store',signal:abort.signal});if(!res.ok)throw new Error('OJ 源码读取失败');const html=await res.text();if(n!==detailVersion||k!==key())return;
            const node=new DOMParser().parseFromString(html,'text/html').querySelector('pre code');if(!node)throw new Error('OJ 未返回源码，请使用提交链接查看');
            const source=ref.code_hash?await core.sourceFromOj(node.textContent,ref.submission_id,ref.code_hash):node.textContent;if(n!==detailVersion||k!==key())return;
            comparison.replaceChildren(el('h3',`${word} ${ref.submission_id}${ref.code_hash?' · 哈希已核对':' · 历史结果未保存上下文哈希'}`),pre(source.split('\n').map((line,i)=>`${i+1}  ${line}`).join('\n')));
          }catch(e){if(n===detailVersion&&k===key())comparison.replaceChildren(el('p',e.name==='AbortError'?'读取已取消或超时':e.message));}finally{clearTimeout(deadline);c.signal.removeEventListener('abort',cancel);load.disabled=false;}
        });detail.append(el('h3',`${word}上下文核验`),load,a,comparison);
      }
      for(const e of r.evidence)detail.append(el('h3',`本提交证据 · 第 ${e.start_line}–${e.end_line} 行`),...(e.explanation?[el('p',e.explanation)]:[]),pre(e.quote));
      detail.append(el('p',r.decision_kind==='rule_feature_candidate'?`核查规则：${r.rule_version}`:`模型：${r.reported_model||r.requested_model||r.model_name}${r.backend_kind==='remote_api'?'（API；请求 '+r.requested_model+'；思考 '+r.requested_thinking_level+'；共享调用 '+r.call_id+'）':''}；${r.run_id?'运行：'+r.run_id+'；提示：'+r.prompt_version:'历史批次：'+r.batch_id}`),el('p',`源码校验：${r.code_hash}`));
      const mark=el('select');mark.setAttribute('aria-label','人工复核标记');for(const [value,text] of [['retained','保留复核'],['ordinary','普通写法'],['insufficient','信息不足']]){const o=el('option',text);o.value=value;mark.append(o);}
      const note=el('textarea');note.placeholder='人工复核备注（仅保存在本机）';note.style.width='100%';note.maxLength=3000;
      const oldId=String(id)+':'+r.code_hash,noteId=r.run_id?r.run_id+':'+oldId:oldId;let saved={};try{saved=JSON.parse(localStorage.getItem(noteKey)||'{}');}catch{}const prior=saved[noteId]||saved[oldId];if(prior){mark.value=prior.status;note.value=prior.note;}
      const feedback=el('p');detail.append(el('h3','本机人工记录'),mark,note,button('保存本机记录',()=>{try{const all=JSON.parse(localStorage.getItem(noteKey)||'{}');all[noteId]={submission_id:String(id),code_hash:r.code_hash,...(r.run_id?{run_id:r.run_id}:{}),status:mark.value,note:note.value};localStorage.setItem(noteKey,JSON.stringify(all));feedback.textContent='已保存。';}catch{feedback.textContent='保存失败。';}}),feedback);
      detail.scrollIntoView({block:'start',behavior:'smooth'});
    }catch(e){if(n===detailVersion)detail.replaceChildren(el('p',e.name==='AbortError'?'读取超时':e.message));}finally{clearTimeout(timeout);}
  }
  async function exportRows(){
    const c=getContext(),k=key();if(!c.contest||!c.summary||!runId)return;const queryBase=query(c,0,100),reader=client(),abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),60000);
    try{
      const all=[];let expected=Infinity;
      for(let offset=0;offset<expected;offset+=100){const r=await reader.search({...queryBase,offset},abort.signal);if(k!==key())return;expected=r.total;all.push(...r.reviews);if(!r.reviews.length)break;}
      const memberMap=core.members(c.summary.rows);let notes={};try{notes=JSON.parse(localStorage.getItem(noteKey)||'{}');}catch{}
      const data=all.map(r=>({name:memberMap.get(String(r.creator_id)).name,student_id:memberMap.get(String(r.creator_id)).studentId,review:r}));
      const payload={exported_at:new Date().toISOString(),class_name:c.className,scheme:'v4',run:runs.find(x=>x.run_id===runId),reviews:data,annotations:all.map(r=>notes[(r.run_id?r.run_id+':':'')+r.submission_id+':'+r.code_hash]||notes[r.submission_id+':'+r.code_hash]).filter(Boolean)};
      const link=el('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));link.href=url;link.download='代码复核结果.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
