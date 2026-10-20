function mountSubmissionReview(reviewCore) {
  const core=createSubmissionCore(),reader=createUpsolveReader(createContestCore().time);
  let current='',dispose=()=>{};
  function sync() {
    const id=ACCODING_APP_PATHNAME.match(/^\/submission\/(\d+)\/?$/)?.[1]||'';
    if(id===current)return;
    const original=document.querySelector('body > pre');
    if(id&&!original?.querySelector('code'))return;
    dispose();current=id;if(!id)return;
    const raw=original.querySelector('code').textContent;let submission;
    try{submission=core.parse(raw,id);}catch{return;}
    const host=document.createElement('main');host.id='am-submission-review';host.className='am-submission-workspace';
    const root=host.attachShadow({mode:'open'});
    const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
    const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
    const link=(text,href)=>{const a=el('a',text);a.href=accodingPath(href);return a;};
    const style=el('style');style.textContent=ACCODING_REVIEW_CSS;
    const wrap=el('div',null,'submission-workspace ar-root'),header=el('header',null,'submission-summary');
    header.append(el('h1',`提交 #${id}`));
    const meta=el('div',null,'meta');meta.append(link(submission.nickname,`/user/${submission.creator_id}/index`),link(`题目 ${submission.problem_id}`,`/problem/${submission.problem_id}/index`),el('span',new Date(submission.timestamp).toLocaleString('zh-CN',{hour12:false})),el('span',submission.result,'badge'+(submission.result==='AC'?'':' result-other')),el('span',`${submission.time} ms · ${submission.memory} KB`));header.append(meta);wrap.append(header);
    const sourceCard=el('section',null,'card'),sourceHead=el('div',null,'card-head'),sourceTitle=el('div');sourceTitle.append(el('h2','本次提交代码'),el('p',`${submission.code.split('\n').length} 行`));
    const copyState=el('span',null,'muted'),sourceActions=el('div',null,'actions');
    sourceActions.append(copyState,button('复制代码',async()=>{try{await navigator.clipboard.writeText(submission.code);copyState.textContent='已复制';}catch{copyState.textContent='复制失败，请选中代码复制。';}}));sourceHead.append(sourceTitle,sourceActions);
    const source=el('pre',null,'code');source.setAttribute('aria-label','本次提交源码');
    for(const [i,text] of submission.code.split('\n').entries()){const line=el('span',null,'code-line');line.append(el('span',String(i+1),'number'),el('span',text+'\n','text'));source.append(line);}
    sourceCard.append(sourceHead,source);const grid=el('div',null,'submission-grid'),codeArea=el('div',null,'submission-code');codeArea.append(sourceCard);grid.append(codeArea);wrap.append(grid);
    const comparison=el('section',null,'card'),diffHead=el('div',null,'card-head'),diffTitle=el('div');diffTitle.append(el('h2','与上一次提交的差异'),el('p','同一学生 · 同一题目'));
    const diffBody=el('div',null,'body'),compareButton=button('加载前后差异',()=>void compare());diffHead.append(diffTitle,compareButton);comparison.append(diffHead,diffBody);diffBody.append(el('p','加载后显示删除的旧代码和新增的本次代码。','muted'));codeArea.append(comparison);
    const feedback=el('section',null,'card'),feedbackHead=el('div',null,'card-head'),feedbackBody=el('div',null,'body');feedback.classList.add('submission-feedback');feedbackHead.append(el('h2','代码复核'),button('刷新判定',()=>void panel.openDetail(id)));feedback.append(feedbackHead,feedbackBody);grid.append(feedback);
    const nav=el('nav',null,'submission-sections');nav.setAttribute('aria-label','提交检查区域');for(const [label,target]of [['本次代码',sourceCard],['前后差异',comparison],['人工复核',feedback]]){const item=button(label,()=>{for(const sibling of nav.children)sibling.removeAttribute('aria-current');item.setAttribute('aria-current','location');target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});if(!nav.children.length)item.setAttribute('aria-current','location');nav.append(item);}header.after(nav);
    const content=el('div',null,'submission-content');content.append(...wrap.childNodes);const rail=el('nav',null,'submission-rail');rail.setAttribute('aria-label','工作台导航');const brand=link('accoding','/');brand.className='submission-brand';brand.prepend(workspaceIcon('grid'));rail.append(brand);for(const [label,path]of [['题目管理','/problem/index'],['赛事管理','/contest/index'],['评测记录','/submission/index']]){const a=link(label,path);if(path==='/submission/index')a.setAttribute('aria-current','page');rail.append(a);}
    const topbar=el('header',null,'am-topbar');topbar.append(link('← 评测记录','/submission/index'),el('div',null,'am-top-actions'));wrap.append(rail,topbar,content);root.append(style,wrap);
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
