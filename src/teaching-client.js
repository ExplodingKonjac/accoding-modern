function createTeachingClient() {
  const key='accoding-modern.teaching.connection.v1';
  const read=()=>JSON.parse((typeof GM_getValue==='function'?GM_getValue(key,''):localStorage.getItem(key))||'{}');
  let connection=read();
  function save(value){connection=value;const text=JSON.stringify(value);if(typeof GM_setValue==='function')GM_setValue(key,text);else localStorage.setItem(key,text);}
  const base=()=>connection.url||'https://muzermat.online:8443/oj-review-api/v4/teaching';
  async function request(path,{query={},body,method,signal,blob=false}={}){
    const url=new URL(base().replace(/\/$/,'')+'/api/modern'+path);
    for(const [key,value] of Object.entries(query))if(value!==''&&value!=null)url.searchParams.set(key,String(value));
    const options={method:method||(body?'POST':'GET'),headers:{...(body?{'Content-Type':'application/json'}:{}),...(connection.token?{Authorization:'Bearer '+connection.token}:{})},body:body?JSON.stringify(body):undefined,signal};
    let response;
    if(url.origin!==location.origin&&typeof GM_xmlhttpRequest==='function'){
      response=await new Promise((resolve,reject)=>{
        const abort=()=>{handle.abort();reject(new DOMException('已取消','AbortError'));};
        const done=fn=>value=>{signal?.removeEventListener('abort',abort);fn(value);};
        const handle=GM_xmlhttpRequest({url:url.href,method:options.method,headers:options.headers,data:options.body,anonymous:true,timeout:30000,responseType:blob?'blob':'text',onload:done(r=>resolve(new Response(blob?r.response:r.responseText,{status:r.status}))),onerror:done(()=>reject(Error('教学服务连接失败，请检查地址和网络'))),ontimeout:done(()=>reject(Error('教学服务请求超时')))});
        signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      });
    }else response=await fetch(url,{...options,credentials:'same-origin',cache:'no-store'});
    if(!response.ok){const data=await response.json();throw Error(data.detail||'教学服务请求失败（'+response.status+'）');}
    return blob?response.blob():response.json();
  }
  return {request,base,connection:()=>connection,async connect(url,username,password){save({url:url.replace(/\/$/,'')});const result=await request('/connect',{body:{username,password}});save({url:base(),token:result.token});return result;},async disconnect(){await request('/disconnect',{body:{}});save({url:base()});}};
}
