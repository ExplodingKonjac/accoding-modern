function mountBackNavigation() {
  if (document.getElementById('am-back-style')) return;
  const style=document.createElement('style');style.id='am-back-style';
  style.textContent=`#am-back-nav{grid-column:1/-1;width:100%;clear:both;margin:0 0 18px;line-height:1.5}#am-back-nav a{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border:1px solid #d4dfec;border-radius:8px;background:#fff;color:#315d9b;font:500 14px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-decoration:none}#am-back-nav a:hover{background:#edf4ff;border-color:#adc7ea}#am-back-nav a:focus-visible{outline:2px solid #377ce2;outline-offset:3px}.am #page.am-problem-layout:has(>#am-back-nav){grid-template-rows:auto 1fr}@media print{#am-back-nav{display:none}}`;
  document.head.append(style);
  function parent() {
    if (location.pathname.startsWith('/contest-ng/')) {
      const parts=location.hash.replace(/^#\//,'').split('/').filter(Boolean);
      if (!/^\d+$/.test(parts[0]||'')) return null;
      return parts.length>1 ? {href:location.pathname+'#/'+parts.slice(0,-1).join('/'),title:'返回比赛上级页面'} : {href:'/contest/index',title:'返回赛事列表'};
    }
    const match=location.pathname.match(/^\/(problem|contest|group|submission|user)\/(.*)$/);
    if (!match) return null;
    const [,kind,rest]=match, parts=rest.split('/').filter(Boolean);
    const names={problem:'题目',contest:'赛事',group:'小组',submission:'评测记录',user:'个人信息'};
    if (/^\d+$/.test(parts[0])) {
      if(parts.length>1&&parts[1]!=='index')return {href:`/${kind}/${parts[0]}/index`,title:`返回${names[kind]}详情`};
      return {href:kind==='user'?'/':`/${kind}/index`,title:kind==='user'?'返回首页':`返回${names[kind]}列表`};
    }
    return parts[0]==='index'?{href:'/',title:'返回首页'}:{href:kind==='user'?'/':`/${kind}/index`,title:`返回${names[kind]}列表`};
  }
  function update() {
    const target=parent();
    const content=document.querySelector('#page')||document.querySelector('[ng-view]>.col-lg-10');
    if(!target||!content){document.getElementById('am-back-nav')?.remove();return;}
    let nav=document.getElementById('am-back-nav');
    if(!nav){nav=document.createElement('div');nav.id='am-back-nav';const link=document.createElement('a');link.textContent='← 上一页';nav.append(link);content.prepend(nav);}
    const link=nav.firstElementChild;
    if(link.getAttribute('href')!==target.href){link.setAttribute('href',target.href);link.title=target.title;link.setAttribute('aria-label','上一页：'+target.title);}
  }
  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update();});};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',schedule);
  update();
}
