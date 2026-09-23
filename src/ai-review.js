function createAiReviewPanel(container,core,getContext,_readMetadata,options={}) {
  const noteKey='accoding-modern.ai-review.notes.v1';
  let accessToken='';
  let generation=0,controller=null,timer=null,rows=[],page=0,total=0,active=false,detailVersion=0,detailController=null,runs=[],runId='',scope=null,listDirty=false,listPosition=null;
  let cursor=null,updateNavigation=()=>{},navigationBusy=false,saving=false;
  const getToken=()=>accessToken;
  const client=core.featureClient(getToken,fetch,4),size=30;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);return n;};
  const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
  const refill=(s,values,keep=s.value)=>{s.replaceChildren();for(const [value,text] of values){const o=el('option',text);o.value=value;s.append(o);}if([...s.options].some(o=>o.value===keep))s.value=keep;};
  const select=(name,values)=>{const s=el('select');s.setAttribute('aria-label',name);refill(s,values);s.onchange=()=>{page=0;void reload();};return s;};
  const labels={suspected:'已核查为AI',ordinary:'已核查为无AI'};
  const stateNames=core.reviewStates;
  const problem=select('复核题目',[['all','全部题目']]);
  const feature=select('代码特征',[['all','全部特征'],...core.featureLabels.map(x=>[x,x])]);
  const state=select('代码状态',options.problemList?[['all','全部代码状态'],...Object.entries(stateNames)]:[['queue','待复核与已判 AI'],['rule_hit_unreviewed','规则命中/未核查'],['reviewed_ai','已核查为AI']]);
  const heading=el('h2','代码复核');
  const message=el('p','读取比赛后，打开代码复核。');message.setAttribute('role','status');
  const progress=el('p');progress.setAttribute('aria-live','polite');
  const list=el('div');list.className='table-wrap';const pager=el('div');pager.className='pager';const detail=el('section');detail.className='panel';detail.hidden=true;
  const style=el('style');style.textContent=`.ar-toolbar,.ar-actions,.ar-review-head,.ar-review-nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.ar-toolbar select{min-width:140px;flex:1}.ar-actions button{min-height:38px}.ar-note{display:block;width:100%;min-height:100px;padding:12px;border:1px solid #ccd9e9;border-radius:8px;box-sizing:border-box;font:inherit}.ar-source{font:13px/1.65 ui-monospace,monospace;overflow:auto;max-height:540px;background:#f7f9fc;padding:12px;border:1px solid #dce3ed;border-radius:8px}.ar-history{border-left:3px solid #d7e3f7;padding:10px 14px;margin:12px 0}.ar-table td{white-space:normal;min-width:90px}.ar-table td:last-child{white-space:nowrap}.ar-review-page,.ar-student-page{position:fixed;inset:0;z-index:2147483002;overflow:auto;background:#eef3f9;padding:18px max(18px,calc((100vw - 1600px)/2));margin:0;border:0;border-radius:0;box-sizing:border-box}.ar-student-page{z-index:2147483003}.ar-review-page:has(.ar-student-page){overflow:hidden}.ar-current-submission{background:#e8f0ff}.ar-review-head{position:sticky;top:0;z-index:3;background:#fff;padding:10px 16px;border:1px solid #dfe7f0;border-radius:12px;justify-content:space-between}.ar-review-head h2{margin:0;font-size:19px}.ar-review-nav{margin:0}.ar-state{font-weight:700;border-radius:8px;padding:5px 12px;background:#e8f0ff;color:#3156a1}.ar-state[data-state=reviewed_ai]{background:#fff0e6;color:#a14718}.ar-state[data-state=reviewed_no_ai]{background:#e7f7ed;color:#216b3f}.ar-state[data-state=rule_unmatched]{background:#eef1f5;color:#526175}.ar-compare{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;border:1px solid #dce3ed;border-radius:10px;overflow:hidden;background:#fff}.ar-compare-title{font-weight:700;padding:10px 14px;background:#f2f6fc;border-bottom:1px solid #dce3ed}.ar-compare-title:nth-child(2){border-left:1px solid #dce3ed}.ar-compare-row{display:contents}.ar-code-line{min-width:0;overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 ui-monospace,monospace;padding:0 10px;min-height:23px}.ar-code-line:nth-child(2n){border-left:1px solid #dce3ed}.ar-code-line.add{background:#dafbe1;color:#116329}.ar-code-line.remove{background:#ffebe9;color:#82071e}.ar-code-line .num{display:inline-block;min-width:3em;margin-right:10px;text-align:right;color:#8190a4;user-select:none}.ar-review-content{background:#fff;border:1px solid #dfe7f0;border-radius:12px;margin-top:12px;padding:18px}.ar-review-content>h3{margin-top:22px}@media(max-width:700px){.ar-toolbar>*{flex:1 1 150px}.ar-actions>*{flex:1}.ar-review-page{padding:8px}.ar-code-line{font-size:11px}}`;
  const controls=el('div');controls.className='ar-toolbar';controls.append(problem,feature,state);
  const actions=el('div');actions.className='ar-actions';actions.append(button('刷新云端结果',()=>void reload()),button('导出当前结果',()=>void exportRows()));
  const sidInput=el('input');sidInput.placeholder='提交 ID';sidInput.inputMode='numeric';sidInput.type='number';sidInput.min='1';sidInput.autocomplete='off';sidInput.setAttribute('aria-label','复核提交 ID');
  actions.append(sidInput,button('查看提交',()=>{if(/^[1-9]\d*$/.test(sidInput.value.trim()))void openDetail(sidInput.value.trim());else message.textContent='请输入有效的提交 ID。';}));
  sidInput.hidden=true;actions.lastElementChild.hidden=true;
  if(options.feedbackOnly)container.append(style,detail);
  else container.append(style,heading,controls,actions,message,progress,list,pager,detail);
  if(options.submissionId){controls.hidden=actions.hidden=message.hidden=list.hidden=pager.hidden=true;}
  function contextKey(){const c=getContext();return `${c.classId||''}:${c.contest?.id||''}:${c.generation}`;}
  function key(){return contextKey()+':v4:'+runId;}
  function reload(){return options.submissionId?openDetail(options.submissionId):refresh();}
  function stop(){cursor=null;updateNavigation=()=>{};generation++;controller?.abort();detailVersion++;detailController?.abort();clearTimeout(timer);}
  function reset(){stop();scope=null;listDirty=false;listPosition=null;heading.textContent='代码复核';problem.disabled=false;rows=[];runs=[];total=page=0;runId='';detail.hidden=true;detail.replaceChildren();progress.textContent='';message.textContent='读取比赛后，打开代码复核。';draw();}
  function setProblemScope(next){stop();scope=next?{...next,submissionIds:[...next.submissionIds]}:null;page=0;state.value=options.problemList?'all':'queue';feature.value='all';problem.value=scope?.problemId||'all';problem.disabled=!!scope;heading.textContent=scope?`本题提交核查 · ${scope.title}`:'代码复核';detail.hidden=true;detail.replaceChildren();}
  function query(c,offset=page*size,limit=size){return {contest_id:Number(c.contest.id),creator_ids:[...core.members(c.summary.rows).keys()],offset,limit,run_id:runId,...(scope?{problem_id:Number(scope.problemId),submission_ids:scope.submissionIds}:problem.value==='all'?{}:{problem_id:Number(problem.value)}),...(feature.value==='all'?{}:{label:feature.value}),...(options.problemList?{}:{review_queue_only:true}),...(state.value==='queue'||state.value==='all'?{}:{review_status:state.value})};}
  function fillRuns(values){runs=[...values].sort((a,b)=>(Number(b.created_at)||0)-(Number(a.created_at)||0)||b.run_id.localeCompare(a.run_id));const latest=runs[0]?.run_id||'';if(latest!==runId)page=0;runId=latest;}
  function showProgress(){progress.textContent='';}
  async function refresh(){
    stop();const v=generation,k=contextKey(),c=getContext();detail.hidden=true;detail.replaceChildren();
    if(!active||!c.contest||!c.summary){message.textContent='请先读取比赛和榜单。';return;}
    refill(problem,[['all','全部题目'],...c.contest.problems.map(p=>[String(p.id),`${p.label} · ${p.title}`])],scope?.problemId||problem.value);
    const current=new AbortController();controller=current;const timeout=setTimeout(()=>current.abort(),20000);
    rows=[];total=0;draw();message.textContent='正在读取云端复核记录…';
    try{
      const state=await client.progress(c.contest.id,current.signal);if(v!==generation||k!==contextKey())return;
      fillRuns(state.runs);showProgress(runs[0]);if(!runId){message.textContent='尚无核查结果，请先在核查系统发布比赛。';return;}
      accessToken=await ensureReviewAccess(c.contest.id,core);if(v!==generation||k!==contextKey())return;
      const requestKey=key(),result=await client.search(query(c),current.signal);if(v!==generation||requestKey!==key())return;
      const memberMap=core.members(c.summary.rows);rows=result.reviews.map(r=>({...r,member:memberMap.get(String(r.creator_id))}));total=result.total;
      if(total&&page*size>=total){page=Math.floor((total-1)/size);void refresh();return;}
      message.textContent=scope?`${scope.attemptedUsers} 位尝试者按 AC 或最近两次尝试选出 ${scope.submissionIds.length} 条 · 当前显示 ${total} 条`:`${c.className} · ${total} 条`;draw();
    }catch(e){if(v===generation){rows=[];total=0;draw();message.textContent=e.name==='AbortError'?'读取超时，请刷新重试。':e.message;}}
    finally{clearTimeout(timeout);if(controller===current)controller=null;}
  }
  function judgement(r){return stateNames[r.review_status]||'状态未知';}
  function draw(){
    const top=list.scrollTop,left=list.scrollLeft,table=el('table');table.className='ar-table';const thead=el('thead'),head=el('tr');['提交','学生','题目','提交时间','代码状态','依据','详情'].forEach(t=>head.append(el('th',t)));thead.append(head);table.append(thead);
    const body=el('tbody');for(const r of rows){const p=getContext().contest?.problems.find(p=>String(p.id)===String(r.problem_id)),tr=el('tr');
      for(const text of [r.submission_id,`${r.member?.name||r.creator_id} · ${r.member?.studentId||''}`,p?`${p.label} · ${p.title}`:r.problem_id,new Date(r.submitted_at).toLocaleString(),judgement(r),r.annotation?r.annotation.reason:(r.result?.label||r.labels||[]).join('；')])tr.append(el('td',text));
      const td=el('td');td.append(button('查看 / 修改',()=>void openDetail(r.submission_id)));tr.append(td);body.append(tr);}
    table.append(body);list.replaceChildren(table);list.scrollTop=top;list.scrollLeft=left;pager.replaceChildren(el('span',`共 ${total} 条 · ${page+1} / ${Math.max(1,Math.ceil(total/size))}`));
    const previous=button('上一页',()=>{page--;void refresh();}),next=button('下一页',()=>{page++;void refresh();});previous.disabled=page<=0;next.disabled=(page+1)*size>=total;pager.append(previous,next);
  }
  const pre=text=>{const p=el('pre',text);p.className='ar-source';return p;};
  function comparison(before,after,previousId,currentId,{diff=true,rightTitle}={}){
    const box=el('div');box.className='ar-compare';box.setAttribute('aria-label','本次提交与同题上次提交逐行对照');
    box.append(el('div',`本次提交 #${currentId}`),el('div',rightTitle||(previousId?`上次提交 #${previousId}`:'当前核查快照中无更早提交')));for(const title of box.children)title.className='ar-compare-title';
    if(before!==null&&!diff){const current=after.split('\n'),reference=before.split('\n');for(let i=0;i<Math.max(current.length,reference.length);i++)box.append(cell(current[i]===undefined?null:{text:current[i]},i+1,''),cell(reference[i]===undefined?null:{text:reference[i]},i+1,''));return box;}
    const lines=before===null?after.split('\n').map((text,i)=>({kind:'equal',text,newLine:i+1,oldLine:null})):core.lineDiff(before,after);
    function cell(line,number,kind){const node=el('div');node.className='ar-code-line '+(kind||'');if(line){const num=el('span',String(number));num.className='num';node.append(num,document.createTextNode(line.text||' '));}else node.append(document.createTextNode(' '));return node;}
    let removed=[],added=[];
    function flush(){for(let i=0;i<Math.max(removed.length,added.length);i++)box.append(cell(added[i],added[i]?.newLine,added[i]?'add':''),cell(removed[i],removed[i]?.oldLine,removed[i]?'remove':''));removed=[];added=[];}
    for(const line of lines){if(line.kind==='add')added.push(line);else if(line.kind==='remove')removed.push(line);else{flush();box.append(cell(line,line.newLine,''),cell(before===null?null:line,line.oldLine,''));}}flush();return box;
  }
  async function readOj(id,hash,signal){const res=await fetch(`/submission/${id}`,{credentials:'same-origin',cache:'no-store',signal});if(!res.ok)throw Error('OJ 源码读取失败');const node=new DOMParser().parseFromString(await res.text(),'text/html').querySelector('pre code');if(!node)throw Error('OJ 未返回源码，请先登录 OJ。');return core.sourceFromOj(node.textContent,id,hash);}
  async function openDetail(id,continuing=false){
    if(!continuing)cursor=core.reviewCursor(rows,page*size,total);
    if(detail.hidden){const overlay=container.closest('.problem-review-page')||container.closest('.overlay');listPosition={listTop:list.scrollTop,listLeft:list.scrollLeft,overlayTop:overlay?.scrollTop||0};}
    clearTimeout(timer);const n=++detailVersion,base=contextKey();detail.classList.toggle('ar-review-page',!options.feedbackOnly);detail.hidden=false;detail.replaceChildren(el('p','正在读取复核详情…'));detailController?.abort();
    const c=new AbortController(),timeout=setTimeout(()=>c.abort(),20000);detailController=c;
    const valid=()=>n===detailVersion&&base===contextKey();
    try{
      if(options.submissionId||!runId){const state=await client.submissionRuns(String(id),c.signal);if(!valid())return;fillRuns(state.runs);showProgress(runs[0]);}
      if(runId){accessToken=await ensureReviewAccess(runs[0].contest_id,core);if(!valid())return;}
      let r=runId?await client.detail(String(id),runId,c.signal):null;if(!valid())return;
      if(!r&&runId&&getToken()){const source=await client.source(String(id),runId,c.signal);r={...source,run_id:runId,decision_kind:'unflagged',review_status:'rule_unmatched',result:{label:[],reason:'规则未命中；可人工复核并填写理由。'},evidence:[],code:await readOj(id,source.code_hash,c.signal)};}
      if(!valid())return;
      if(r&&typeof r.code!=='string')r.code=await readOj(id,r.code_hash,c.signal);
      if(!valid())return;
      if(r&&!options.submissionId){const ctx=getContext();if(r.contest_id!==Number(ctx.contest.id)||!core.members(ctx.summary.rows).has(String(r.creator_id)))throw Error('详情与当前班级不一致');}
      if(options.feedbackOnly){
        detail.replaceChildren();
        if(!r){detail.append(el('p','此提交尚未纳入云端源码清单，暂时无法保存 AI 判定。'));return;}
        r.code=await core.sourceFromOj(options.ojText,id,r.code_hash);if(!valid())return;
        const label=el('p',judgement(r));label.dataset.reviewJudgement='1';label.className='ar-verdict';
        const reason=el('p',r.annotation?.reason||r.result.reason);reason.dataset.reviewReason='1';detail.append(label,reason);
        if(r.evidence?.length){const evidence=el('details');evidence.append(el('summary','查看规则依据'));for(const e of r.evidence)evidence.append(el('h4',`第 ${e.start_line}–${e.end_line} 行`),pre(e.quote));detail.append(evidence);}
        await feedbackEditor(r,c.signal,valid);return;
      }
      const close=button('返回列表',()=>void closeDetail(c));
      const head=el('div');head.className='ar-review-head';const title=el('h2',`代码复核 · 提交 #${id}`),nav=el('div');nav.className='ar-review-nav';
      const badge=el('span',r?judgement(r):'状态未知');badge.className='ar-state';badge.dataset.state=r?.review_status||'';badge.dataset.reviewJudgement='1';
      const previous=button('上一页',()=>void turn(-1,id)),next=button('下一页',()=>void turn(1,id));
      updateNavigation=()=>{previous.disabled=saving||navigationBusy||!cursor?.has(id,-1);next.disabled=saving||navigationBusy||!cursor?.has(id,1);};updateNavigation();
      nav.append(previous,next);if(r&&options.loadContestSubmissions)nav.append(button('查看该同学本次比赛提交',()=>void showContestSubmissions(r,valid)));nav.append(badge,close);head.append(title,nav);detail.replaceChildren(head);
      if(!r){detail.append(el('p','尚无可用结果。请先在核查系统同步此比赛的源码清单。'));return;}
      const content=el('div');content.className='ar-review-content';detail.append(content);
      const member=getContext().summary?core.members(getContext().summary.rows).get(String(r.creator_id)):null;
      const problemName=pid=>{const p=getContext().contest?.problems.find(item=>String(item.id)===String(pid));return p?`${p.label} · ${p.title}`:`题目 ${pid}`;};
      const meta=el('p',`用户 ${member?.name||r.creator_id} · ${problemName(r.problem_id)} · ${new Date(r.submitted_at).toLocaleString()}`);
      content.append(meta,el('p','原始依据：'+(r.result?.reason||'无')),el('p','原始特征：'+((r.result?.label||[]).join('；')||'无')));
      const compare=el('section');content.append(compare);
      const snapshots=[];
      if((r.result?.label||r.labels||[]).includes('跨题码风变化')){
        for(const ref of r.context_references||[]){
          if(String(ref.submission_id)===String(id))continue;
          try{const source=await client.source(ref.submission_id,r.run_id,c.signal);if(!valid())return;
            if(String(source.creator_id)===String(r.creator_id)&&String(source.problem_id)!==String(r.problem_id)&&source.code_hash===ref.code_hash)
              snapshots.push({id:ref.submission_id,hash:ref.code_hash,problemId:source.problem_id,kind:'cross'});
          }catch(e){if(!valid())return;compare.append(el('p',`跨题对照 #${ref.submission_id} 的题目信息读取失败：${e.message}`));}
        }
      }
      const prior=r.previous_submission;
      if(prior&&!snapshots.some(item=>String(item.id)===String(prior.submission_id)))snapshots.push({id:prior.submission_id,hash:prior.code_hash,problemId:prior.problem_id,kind:'previous'});
      if(!snapshots.length)compare.append(comparison(null,r.code,null,id));
      else{
        const nav=el('div');nav.className='ar-review-nav';const view=el('div'),position=el('span');let snapshotPage=0,snapshotVersion=0;
        const backward=button('上一份对照',()=>void showSnapshot(snapshotPage-1)),forward=button('下一份对照',()=>void showSnapshot(snapshotPage+1));
        nav.append(backward,position,forward);compare.append(nav,view);
        async function showSnapshot(nextPage){if(nextPage<0||nextPage>=snapshots.length)return;snapshotPage=nextPage;const version=++snapshotVersion,item=snapshots[nextPage];
          backward.disabled=nextPage===0;forward.disabled=nextPage===snapshots.length-1;
          position.textContent=`右侧快照 ${nextPage+1} / ${snapshots.length}`;
          const label=item.kind==='cross'?`跨题码风对照 · ${problemName(item.problemId)} · 提交 #${item.id}`:`同题上次提交 · ${problemName(item.problemId)} · 提交 #${item.id}`;
          view.replaceChildren(el('p',`正在读取${label}…`));
          try{const before=await readOj(item.id,item.hash,c.signal);if(!valid()||version!==snapshotVersion)return;
            view.replaceChildren(comparison(before,r.code,item.id,id,{diff:item.kind==='previous',rightTitle:label}));
          }catch(e){if(!valid()||version!==snapshotVersion)return;view.replaceChildren(el('p',`${label}读取失败：${e.message}`),comparison(null,r.code,null,id,{rightTitle:label}));}
        }
        await showSnapshot(0);if(!valid())return;
      }
      for(const e of r.evidence||[])content.append(el('h3',`规则证据 · 第 ${e.start_line}–${e.end_line} 行`),pre(e.quote));
      content.append(el('p',`源码校验：${r.code_hash}`));
      await feedbackEditor(r,c.signal,valid);
      if(valid())detail.scrollTop=0;
    }catch(e){if(valid()){const error=el('p',e.name==='AbortError'?'读取超时，请重试。':e.message);if(options.feedbackOnly)detail.replaceChildren(error);else detail.replaceChildren(button('返回列表',()=>void closeDetail(c)),error);}}finally{clearTimeout(timeout);}
  }
  async function closeDetail(controller){detailVersion++;controller.abort();detail.hidden=true;detail.replaceChildren();if(listDirty){listDirty=false;await refresh();}if(listPosition){list.scrollTop=listPosition.listTop;list.scrollLeft=listPosition.listLeft;const overlay=container.closest('.problem-review-page')||container.closest('.overlay');if(overlay)overlay.scrollTop=listPosition.overlayTop;listPosition=null;}}
  async function turn(direction,id){
    if(navigationBusy||saving||!cursor?.has(id,direction))return;
    const currentCursor=cursor,version=detailVersion,base=contextKey();navigationBusy=true;updateNavigation();
    try{
      let target=currentCursor.neighbor(id,direction);
      if(!target){const request=currentCursor.request(direction);if(!request)return;
        const result=await client.search(query(getContext(),request.offset,request.limit),AbortSignal.any([detailController.signal,AbortSignal.timeout(20000)]));
        if(version!==detailVersion||base!==contextKey())return;
        currentCursor.extend(result,request,direction);target=currentCursor.neighbor(id,direction);
      }
      if(target)await openDetail(target,true);
    }catch(e){if(version===detailVersion){let message=detail.querySelector('[data-navigation-error]');if(!message){message=el('p');message.dataset.navigationError='1';detail.querySelector('.ar-review-head')?.append(message);}message.textContent='翻页失败，请重试：'+e.message;}}
    finally{navigationBusy=false;updateNavigation();}
  }
  async function showContestSubmissions(r,valid){
    if(detail.querySelector('.ar-student-page'))return;
    const ctx=getContext(),member=core.members(ctx.summary.rows).get(String(r.creator_id)),panel=el('section');panel.className='ar-student-page';panel.setAttribute('aria-label','该同学本次比赛提交');
    const header=el('div');header.className='ar-review-head';header.append(el('h2',`${member?.name||r.creator_id} · 本次比赛提交`),button('返回当前核查',()=>panel.remove()));
    const content=el('div','正在读取提交记录…');content.className='ar-review-content';panel.append(header,content);detail.append(panel);
    try{
      const records=(await options.loadContestSubmissions()).filter(s=>String(s.creator_id)===String(r.creator_id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)||Number(b.id)-Number(a.id));
      if(!valid()||!panel.isConnected)return;
      let currentPage=0;const problemFilter=el('select');problemFilter.setAttribute('aria-label','本次比赛提交题目');refill(problemFilter,[['all','全部题目'],...ctx.contest.problems.map(p=>[String(p.id),`${p.label} · ${p.title}`])]);
      const list=el('div');list.className='table-wrap';const pager=el('div');pager.className='pager';content.replaceChildren(el('p',`共 ${records.length} 次赛内提交 · 包含全部题目和评测结果`),problemFilter,list,pager);
      function drawSubmissions(){const filtered=records.filter(s=>problemFilter.value==='all'||String(s.problem_id)===problemFilter.value),table=el('table'),head=el('thead'),titles=el('tr');
        ['提交','题目','结果','得分','语言','提交时间','代码'].forEach(t=>titles.append(el('th',t)));head.append(titles);table.append(head);const body=el('tbody');
        for(const s of filtered.slice(currentPage*30,currentPage*30+30)){const row=el('tr'),problem=ctx.contest.problems.find(p=>String(p.id)===String(s.problem_id));if(String(s.id)===String(r.submission_id))row.className='ar-current-submission';
          [String(s.id)===String(r.submission_id)?`${s.id}（当前核查）`:s.id,problem?`${problem.label} · ${problem.title}`:s.problem_id,s.result||'待评测',s.score??'—',s.lang||'—',new Date(s.created_at).toLocaleString()].forEach(t=>row.append(el('td',t)));
          const cell=el('td');if(/^[1-9]\d*$/.test(String(s.id))){const link=el('a','查看代码');link.href=`/submission/${s.id}`;link.target='_blank';link.rel='noopener noreferrer';cell.append(link);}row.append(cell);body.append(row);
        }
        table.append(body);list.replaceChildren(table);const previous=button('上一页',()=>{currentPage--;drawSubmissions();}),next=button('下一页',()=>{currentPage++;drawSubmissions();});previous.disabled=currentPage===0;next.disabled=(currentPage+1)*30>=filtered.length;pager.replaceChildren(el('span',`共 ${filtered.length} 条 · ${currentPage+1} / ${Math.max(1,Math.ceil(filtered.length/30))}`),previous,next);
      }
      problemFilter.onchange=()=>{currentPage=0;drawSubmissions();};drawSubmissions();
    }catch(e){if(valid()&&panel.isConnected)content.replaceChildren(el('p','提交读取失败：'+e.message),button('重试',()=>{panel.remove();void showContestSubmissions(r,valid);}));}
  }
  async function feedbackEditor(r,signal,valid){
    let history=await client.feedback(r.submission_id,r.code_hash,r.run_id,signal);if(!valid())return;
    const mark=el('select');mark.setAttribute('aria-label','人工复核结论');refill(mark,Object.entries(labels));
    const note=el('textarea');note.className='ar-note';note.placeholder='请说明更正或补报的理由，供其他助教及后续规则优化参考。';note.maxLength=3000;note.setAttribute('aria-label','人工复核理由');
    if(history.latest){mark.value=history.latest.status;note.value=history.latest.reason;}else{mark.value=r.annotation?.status||(r.decision_kind==='unflagged'?'ordinary':'suspected');try{const notes=JSON.parse(localStorage.getItem(noteKey)||'{}'),old=notes[r.run_id+':'+r.submission_id+':'+r.code_hash]||notes[r.submission_id+':'+r.code_hash];if(old){mark.value=({retained:'suspected',ordinary:'ordinary'})[old.status]||mark.value;note.value=old.note||'';}}catch{}}
    const status=el('p'),historyBox=el('div'),bar=el('div');bar.className='ar-actions';let pending=null;
    function drawHistory(){historyBox.replaceChildren();for(const h of history.history){const item=el('div');item.className='ar-history';const title=el('strong',`${h.reviewer_name} · ${labels[h.status]} · ${new Date(h.created*1000).toLocaleString()}`);title.title=h.reviewer_id||'';item.append(title,el('p',h.reason));historyBox.append(item);void reviewHistoryName(h).then(name=>{if(valid()&&title.isConnected)title.textContent=`${name} · ${labels[h.status]} · ${new Date(h.created*1000).toLocaleString()}`;});}if(!history.history.length)historyBox.append(el('p','暂无云端人工记录。'));}
    const save=button('保存结论与理由到云端',async()=>{if(!note.value.trim()){status.textContent='请填写理由后保存。';note.focus();return;}save.disabled=true;saving=true;updateNavigation();const body={submission_id:r.submission_id,code_hash:r.code_hash,run_id:r.run_id,status:mark.value,reason:note.value.trim(),code:r.code,base_revision:history.latest?.id||0};const signature=JSON.stringify(body);if(pending?.signature!==signature)pending={signature,request_id:crypto.randomUUID()};try{await client.saveFeedback({...body,request_id:pending.request_id},AbortSignal.timeout(20000));if(!valid())return;history=await client.feedback(r.submission_id,r.code_hash,r.run_id,AbortSignal.timeout(15000));if(!valid())return;pending=null;r.annotation=history.latest;r.review_status=history.latest.status==='suspected'?'reviewed_ai':'reviewed_no_ai';const visible=(options.problemList||r.review_status!=='reviewed_no_ai')&&(state.value==='all'||state.value==='queue'||state.value===r.review_status);cursor?.setVisible(r.submission_id,visible);listDirty=true;const rowIndex=rows.findIndex(x=>String(x.submission_id)===String(r.submission_id)&&x.code_hash===r.code_hash);if(rowIndex>=0){if(!visible){rows.splice(rowIndex,1);total=Math.max(0,total-1);}else{rows[rowIndex].annotation=history.latest;rows[rowIndex].review_status=r.review_status;}}draw();const label=detail.querySelector('[data-review-judgement]');if(label){label.textContent=judgement(r);label.dataset.state=r.review_status;}const reason=detail.querySelector('[data-review-reason]');if(reason)reason.textContent=history.latest.reason;drawHistory();status.textContent='已保存到云端，其他助教刷新后即可查看。';}catch(e){if(valid())status.textContent=e.message+'；草稿已保留，可重试或先刷新历史。';}finally{save.disabled=false;saving=false;if(valid())updateNavigation();}});save.className='primary';
    bar.append(mark,save,button('刷新云端历史',async()=>{try{history=await client.feedback(r.submission_id,r.code_hash,r.run_id,AbortSignal.timeout(15000));if(valid()){drawHistory();status.textContent='已刷新历史；当前理由草稿保留，请核对后再保存。';}}catch(e){if(valid())status.textContent=e.message;}}));
    const target=options.feedbackOnly?detail:detail.querySelector('.ar-review-content')||detail;
    target.append(el('h3','助教复核'),note,bar,status,el('h3','云端修改历史'),historyBox);drawHistory();
  }
  async function exportRows(){
    const c=getContext(),k=key();if(!c.contest||!c.summary||!runId)return;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),60000);
    try{const all=[];let expected=Infinity;for(let offset=0;offset<expected;offset+=100){const r=await client.search(query(c,offset,100),abort.signal);if(k!==key())return;expected=r.total;all.push(...r.reviews);if(!r.reviews.length)break;}
      const feedback=[];if(getToken()){let after=0;while(true){const packet=await client.exportFeedback(c.contest.id,after,abort.signal);if(k!==key())return;feedback.push(...packet.feedback);if(!packet.feedback.length)break;after=packet.next_after;}}
      const memberMap=core.members(c.summary.rows),payload={exported_at:new Date().toISOString(),class_name:c.className,run_id:runId,reviews:all.map(r=>({name:memberMap.get(String(r.creator_id))?.name,student_id:memberMap.get(String(r.creator_id))?.studentId,review:r})),feedback};
      const link=el('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));link.href=url;link.download='代码复核与助教反馈.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){message.textContent='导出失败：'+e.message;}finally{clearTimeout(timeout);}
  }
  return {reset,openDetail,setProblemScope,setActive(value){active=value;if(value)return refresh();stop();}};
}
