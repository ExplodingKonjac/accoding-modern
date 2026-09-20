function mountUpdateNotice(version) {
  if(document.getElementById('am-update-notice'))return;
  let storage;try{storage=localStorage;}catch{}
  const checker=createUpdateChecker({version,storage});
  const host=document.createElement('div');host.id='am-update-notice';document.body.append(host);
  const root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>:host{all:initial;font:14px/1.5 system-ui;color:#25344b}section{position:fixed;left:20px;bottom:20px;z-index:2147483600;max-width:min(390px,calc(100vw - 72px));padding:16px;background:#fff;border:1px solid #c9d8ee;border-radius:12px;box-shadow:0 6px 30px #17253a33}section[hidden]{display:none}p{margin:0 0 10px}.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}a{color:#235de4;text-decoration:none}button{font:inherit;color:#52647e;background:#f2f5fa;border:1px solid #d9e2ee;border-radius:6px;padding:5px 10px;cursor:pointer}</style><section hidden aria-label="脚本更新" role="status"><p></p><div class="actions"></div></section>';
  const box=root.querySelector('section'),message=root.querySelector('p'),actions=root.querySelector('.actions');
  let feedback;
  function show(result,manual){
    if(!manual&&(!result.available||result.dismissed))return;
    actions.replaceChildren();
    message.textContent=result.error?`当前 ${version}。本次检查失败。${result.available?'上次查到 '+result.latestVersion+'，可打开安装页核对。':'可直接打开安装页，或稍后重试。'}`:result.available?`发现 ${result.latestVersion}，当前为 ${version}。点击“立即更新”后，请在篡改猴中确认安装，再刷新 OJ 页面。`:`检查成功，当前已是最新版 ${version}。`;
    if(feedback&&manual)feedback.textContent=result.error?`当前 ${version} · 检查失败`:result.available?`当前 ${version} · 可更新至 ${result.latestVersion}`:`当前 ${version} · 已是最新版`;
    if(result.available||result.error){
      for(const [text,url] of [[result.error?'打开更新安装页':'立即更新',result.installUrl],['更新说明',result.releaseUrl]]){const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}
    }
    const close=document.createElement('button');close.type='button';close.textContent=result.available?'稍后':'关闭';close.onclick=()=>{box.hidden=true;if(result.available)checker.dismiss(result.latestVersion);};actions.append(close);box.hidden=false;
  }
  const classRoot=document.querySelector('#am-classes')?.shadowRoot;
  if(classRoot){
    const button=document.createElement('button');button.type='button';button.textContent='检查更新';button.dataset.action='check-script-update';
    feedback=document.createElement('span');feedback.setAttribute('role','status');feedback.style.cssText='font-size:13px;color:#52647e;margin-left:8px';
    button.onclick=async()=>{button.disabled=true;button.textContent='正在检查…';feedback.textContent=`当前 ${version} · 正在联网检查`;try{show(await checker.check(true),true);}finally{button.disabled=false;button.textContent='检查更新';}};
    classRoot.querySelector('header .tag').after(button);
    button.after(feedback);
  }
  void checker.check().then(result=>show(result,false));
}
