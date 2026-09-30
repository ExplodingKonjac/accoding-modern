function reviewFetch(url,options={}) {
  if (!['https://accoding-4000.e1.buaa.edu.cn','https://accoding-4000.e2.buaa.edu.cn','https://accoding-4000.e3.buaa.edu.cn','https://d.buaa.edu.cn'].includes(location.origin) ||
      !url.startsWith('https://muzermat.online:8443/oj-review-api/v4/')) return fetch(url,options);
  if (typeof GM_xmlhttpRequest!=='function') return Promise.reject(new Error('VPN 核查需要脚本管理器的跨域请求权限，请重新安装最新版脚本。'));
  return new Promise((resolve,reject)=>{
    const signal=options.signal;
    if(signal?.aborted){reject(signal.reason||new DOMException('Aborted','AbortError'));return;}
    let request,finished=false;
    const cleanup=()=>signal?.removeEventListener('abort',abort);
    const finish=(callback,value)=>{if(finished)return;finished=true;cleanup();callback(value);};
    const abort=()=>{request?.abort();finish(reject,signal.reason||new DOMException('Aborted','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    try {
      request=GM_xmlhttpRequest({url,method:options.method||'GET',headers:options.headers||{},data:options.body,
        anonymous:true,timeout:20000,
        onload:response=>finish(resolve,new Response(response.responseText,{status:response.status,headers:{'Content-Type':'application/json'}})),
        onerror:()=>finish(reject,new Error('云端核查连接失败，请检查网络或脚本管理器跨域权限。')),
        ontimeout:()=>finish(reject,new Error('云端核查请求超时。')),
        onabort:()=>finish(reject,new DOMException('Aborted','AbortError'))});
      if(signal?.aborted)abort();
    }catch(error){finish(reject,error);}
  });
}
