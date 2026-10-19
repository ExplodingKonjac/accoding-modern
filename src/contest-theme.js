// The contest Angular app replaces its ng-view on hash navigation and has no #page/#navbar.
// Scope styles to its stable template selectors so late ng-include and route changes work.
(() => {
  if (!/^\/contest-ng\//.test(ACCODING_APP_PATHNAME) || document.getElementById('am-ng-style')) return;
  const toggle=value=>{interfacePreference.setDisabled(value);location.reload();};
  if(interfacePreference.disabled()){
    mountOriginalInterfaceControl(interfacePreference);return;
  }
  const control=document.createElement('button');control.type='button';
  const style=document.createElement('style');style.id='am-ng-style';
  style.textContent=ACCODING_WORKSPACE_CSS;
  document.head.append(style);document.documentElement.classList.add('am-ng');
  control.textContent='恢复原版外观';control.className='am-ng-reset';control.addEventListener('click',()=>toggle(true));
  const enhance=()=>{
    const nav=document.querySelector('[ng-view]>nav .navbar-middle');
    if(nav&&!control.isConnected){const li=document.createElement('li');li.append(control);nav.append(li);}
    // Keep original table nodes and all Angular bindings; only add a scroll container.
    for(const table of document.querySelectorAll('[ng-view]>.col-lg-10 table')){
      if(table.closest('.am-ng-table-wrap,.modal,.popover')||table.parentElement.closest('table'))continue;
      const wrap=document.createElement('div');wrap.className='am-ng-table-wrap';table.before(wrap);wrap.append(table);
    }
  };
  let pending=false;
  const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;enhance();});}});
  observer.observe(document.body,{childList:true,subtree:true});enhance();
})();
