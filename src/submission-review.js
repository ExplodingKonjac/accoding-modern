function mountSubmissionReview(reviewCore) {
  const core=createSubmissionCore(),reader=createUpsolveReader(createContestCore().time);
  let current='',dispose=()=>{};
  function sync() {
    const id=location.pathname.match(/^\/submission\/(\d+)\/?$/)?.[1]||'';
    if(id===current)return;
    const original=document.querySelector('body > pre');
    if(id&&!original?.querySelector('code'))return;
    dispose();current=id;if(!id)return;
    const raw=original.querySelector('code').textContent;let submission;
    try{submission=core.parse(raw,id);}catch{return;}
    const host=document.createElement('main');host.id='am-submission-review';
    const root=host.attachShadow({mode:'open'});
    const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
    const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
    const link=(text,href)=>{const a=el('a',text);a.href=href;return a;};
    const style=el('style');style.textContent=`
      :host{display:block;background:#f3f6fb;color:#24324a;min-height:100vh;font:15px/1.65 system-ui,-apple-system,sans-serif}
      *{box-sizing:border-box}[hidden]{display:none!important}button,select,textarea{font:inherit;color:inherit}
      button,a{touch-action:manipulation}button{cursor:pointer;background:#fff;border:1px solid #d4deec;border-radius:9px;padding:8px 15px;font-weight:600}button:hover{border-color:#6a92e5;background:#f4f7ff}button:disabled{opacity:.55;cursor:wait}
      button:focus-visible,a:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #93b4fa;outline-offset:3px}
      a{color:#285ad3;text-decoration:none}a:hover{text-decoration:underline}.wrap{max-width:1400px;margin:auto;padding:28px 36px 64px}
      header{margin-bottom:24px}.eyebrow{color:#65758e;font-size:13px;letter-spacing:.08em}h1{font-size:30px;line-height:1.3;margin:8px 0 18px}h2{font-size:20px;margin:0}h3{font-size:16px;margin:24px 0 12px}p{overflow-wrap:anywhere}.meta,.actions,.card-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.meta{color:#64748b;gap:8px 22px}.badge{padding:3px 11px;background:#e7f3ec;color:#226545;border-radius:6px;font-weight:600}.meta .result-other{background:#eef0f6;color:#4c5c75}
      .card{border:1px solid #dce4f0;border-radius:14px;background:#fff;box-shadow:0 3px 16px #26395904;margin:20px 0;overflow:hidden}.card-head{padding:18px 22px;justify-content:space-between;border-bottom:1px solid #e7edf5}.card-head p{margin:2px 0 0;font-size:13px;color:#64748b}.body{padding:20px 22px}.muted{color:#68778d;font-size:14px}.code{margin:0;padding:14px 0;overflow:auto;tab-size:4;font:13px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace;background:#fcfdff}
      .code-line{display:flex;min-width:max-content}.number{display:inline-block;flex:none;width:56px;padding:0 14px;color:#91a0b4;text-align:right;user-select:none}.text{white-space:pre;padding-right:24px}.code-line:hover{background:#f0f4fa}.diff .number{width:46px;padding:0 8px}.sign{width:24px;flex:none;user-select:none}.remove{background:#ffebe9!important;color:#82071e}.add{background:#dafbe1!important;color:#116329}.diff .code-line .number{color:inherit;opacity:.6}.change-count{font:13px ui-monospace,monospace}.plus{color:#1a7f37}.minus{color:#b42336}.ar-verdict{display:inline-block;font-weight:700;background:#eef3ff;color:#3156a1;border-radius:7px;padding:5px 12px;margin-top:0}.ar-actions select{border:1px solid #d4deec;border-radius:8px;padding:9px;background:#fff}.primary{background:#285de5;color:white;border-color:#285de5}.primary:hover{background:#204fcb;color:white}details summary{cursor:pointer;color:#45618b}.ar-history p{white-space:pre-wrap}.ar-source{max-height:320px!important}
      @media(max-width:650px){.wrap{padding:18px 12px 32px}h1{font-size:25px}.card-head,.body{padding:16px}.meta{gap:7px 14px}.code{font-size:12px}.number{width:42px;padding:0 9px}.card-head .actions{width:100%}.actions button{flex:1}.ar-actions{align-items:stretch}.ar-actions>*{flex:1 1 100%!important}.ar-actions button{white-space:normal}}
    `;
    const wrap=el('div',null,'wrap'),header=el('header');
    header.append(link('← 提交记录','/submission/index'),el('div','SUBMISSION REVIEW','eyebrow'),el('h1',`提交 #${id}`));
    const meta=el('div',null,'meta');meta.append(link(submission.nickname,`/user/${submission.creator_id}/index`),link(`题目 ${submission.problem_id}`,`/problem/${submission.problem_id}/index`),el('span',new Date(submission.timestamp).toLocaleString('zh-CN',{hour12:false})),el('span',submission.result,'badge'+(submission.result==='AC'?'':' result-other')),el('span',`${submission.time} ms · ${submission.memory} KB`));header.append(meta);wrap.append(header);
    const sourceCard=el('section',null,'card'),sourceHead=el('div',null,'card-head'),sourceTitle=el('div');sourceTitle.append(el('h2','本次提交代码'),el('p',`${submission.code.split('\n').length} 行`));
    const copyState=el('span',null,'muted'),sourceActions=el('div',null,'actions');
    sourceActions.append(copyState,button('复制代码',async()=>{try{await navigator.clipboard.writeText(submission.code);copyState.textContent='已复制';}catch{copyState.textContent='复制失败，请选中代码复制。';}}),button('前后差异',()=>comparison.scrollIntoView({behavior:'smooth'})),button('AI 判定',()=>feedback.scrollIntoView({behavior:'smooth'})));sourceHead.append(sourceTitle,sourceActions);
    const source=el('pre',null,'code');source.setAttribute('aria-label','本次提交源码');
    for(const [i,text] of submission.code.split('\n').entries()){const line=el('span',null,'code-line');line.append(el('span',String(i+1),'number'),el('span',text+'\n','text'));source.append(line);}
    sourceCard.append(sourceHead,source);wrap.append(sourceCard);
    const comparison=el('section',null,'card'),diffHead=el('div',null,'card-head'),diffTitle=el('div');diffTitle.append(el('h2','与上一次提交的差异'),el('p','同一学生 · 同一题目'));
    const diffBody=el('div',null,'body'),compareButton=button('加载前后差异',()=>void compare());diffHead.append(diffTitle,compareButton);comparison.append(diffHead,diffBody);diffBody.append(el('p','加载后显示删除的旧代码和新增的本次代码。','muted'));wrap.append(comparison);
    const feedback=el('section',null,'card'),feedbackHead=el('div',null,'card-head'),feedbackBody=el('div',null,'body');feedbackHead.append(el('h2','AI 判定'),button('刷新判定',()=>void panel.openDetail(id)));feedback.append(feedbackHead,feedbackBody);wrap.append(feedback);root.append(style,wrap);
    original.before(host);const wasHidden=original.hidden;original.hidden=true;
    const panel=createAiReviewPanel(feedbackBody,reviewCore,()=>({generation:id}),async()=>[],{submissionId:id,feedbackOnly:true,ojText:raw});void panel.openDetail(id);
    let alive=true,controller=null,loaded=false;
    async function compare() {
      if(loaded){diffBody.hidden=!diffBody.hidden;compareButton.textContent=diffBody.hidden?'展开差异':'收起差异';return;}
      controller?.abort();const abort=new AbortController();controller=abort;const deadline=setTimeout(()=>abort.abort(),60000);compareButton.disabled=true;diffBody.replaceChildren(el('p','正在查询上一份提交…','muted'));
      try{
        const previous=await core.findPrevious(submission,async(offset,signal)=>{
          const res=await fetch(`/submission/index?offset=${offset}`,{method:'POST',credentials:'same-origin',cache:'no-store',signal,body:new URLSearchParams({problem_id:submission.problem_id,nickname:submission.nickname,result:'',language:''})});
          if(!res.ok)throw new Error(`提交列表读取失败（${res.status}）。`);return reader.parsePage(await res.text(),submission.problem_id,offset);
        },abort.signal,page=>{if(alive)diffBody.replaceChildren(el('p',`正在查询上一份提交…已读取 ${page} 页`,'muted'));});
        if(!alive)return;
        if(!previous){diffBody.replaceChildren(el('p','这是该学生在本题的首次提交，没有上一份代码可比较。','muted'));compareButton.hidden=true;return;}
        const response=await fetch(`/submission/${previous.id}`,{credentials:'same-origin',cache:'no-store',signal:abort.signal});if(!response.ok)throw new Error(`前版源码读取失败（${response.status}）。`);
        const text=new DOMParser().parseFromString(await response.text(),'text/html').querySelector('pre code')?.textContent;
        if(!text)throw new Error('前版源码不可用，请检查 OJ 登录和查看权限。');const before=core.parse(text,previous.id);
        if(!core.isPrevious(before,submission))throw new Error('前版源码的学生、题目或时间不匹配，已停止比较。');
        if(!alive)return;
        const diff=reviewCore.lineDiff(before.code,submission.code),added=diff.filter(x=>x.kind==='add').length,removed=diff.filter(x=>x.kind==='remove').length;
        const info=el('div',null,'actions');info.append(link(`上次 #${before.id}`,`/submission/${before.id}`),el('span',`→ 本次 #${id}`),el('span',`+${added}`,'change-count plus'),el('span',`−${removed}`,'change-count minus'));diffBody.replaceChildren(info);
        if(!added&&!removed)diffBody.append(el('p','两次提交的代码完全相同。','muted'));
        else{diffBody.append(el('p','红色 − 为上次删除的行，绿色 + 为本次新增的行；两列行号分别对应上次和本次。','muted'));const box=el('pre',null,'code diff');box.setAttribute('aria-label','前后版本逐行差异');for(const row of diff){const line=el('span',null,'code-line '+row.kind);line.append(el('span',String(row.oldLine??''),'number'),el('span',String(row.newLine??''),'number'),el('span',row.kind==='add'?'+':row.kind==='remove'?'−':' ','sign'),el('span',row.text+'\n','text'));box.append(line);}diffBody.append(box);}
        loaded=true;compareButton.textContent='收起差异';
      }catch(error){if(alive){diffBody.replaceChildren(el('p',error.name==='AbortError'?'查询超时，请重试。':error.message));compareButton.textContent='重试加载';}}
      finally{clearTimeout(deadline);compareButton.disabled=false;}
    }
    dispose=()=>{alive=false;controller?.abort();panel.reset();host.remove();original.hidden=wasHidden;};
  }
  sync();window.addEventListener('popstate',sync);new MutationObserver(sync).observe(document.body,{childList:true});
}
