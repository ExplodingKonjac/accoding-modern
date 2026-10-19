if(new URLSearchParams(location.search).has('review')){
  window.previewReviewReady=(async()=>{
    const settle=async check=>{for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('复核预览初始化失败');};
    const root=document.querySelector('#am-classes').shadowRoot;
    document.querySelector('.am-class-header button').click();
    const select=root.querySelector('#class-select');select.value='demo-a';select.dispatchEvent(new Event('change'));
    await settle(()=>[...root.querySelector('#contest-select').options].some(option=>option.value==='1326'));
    root.querySelector('#contest-select').value='1326';root.querySelector('[data-action=load]').click();
    await settle(()=>!root.querySelector('[data-action=export-score]').disabled);
    root.querySelector('[data-action=review-tab]').click();
    await settle(()=>root.querySelector('#review-pane .ar-table tbody tr'));
    if(new URLSearchParams(location.search).get('review')==='detail'){
      root.querySelector('#review-pane .ar-table tbody button').click();
      await settle(()=>root.querySelector('.ar-review-page .ar-note'));
    }
    return true;
  })();
}
