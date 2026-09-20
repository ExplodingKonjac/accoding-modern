export function createUpdateChecker({version,storage,fetchImpl=fetch,now=Date.now}) {
  const manifestUrl='https://raw.githubusercontent.com/y38501148-max/accoding-modern/main/version.json';
  const installUrl='https://raw.githubusercontent.com/y38501148-max/accoding-modern/main/accoding-modern.user.js';
  const releaseUrl='https://github.com/y38501148-max/accoding-modern/releases';
  const key='accoding-modern.updates.v1',interval=6*60*60*1000,retry=30*60*1000;
  const valid=v=>typeof v==='string'&&/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(v);
  if(!valid(version))throw new Error('无效的当前版本');
  const newer=v=>{const a=v.split('.').map(Number),b=version.split('.').map(Number);for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;};
  let memory={},pending=null;
  function read(){try{const v=JSON.parse(storage?.getItem(key)||'null');if(v&&typeof v==='object'&&!Array.isArray(v))memory=v;}catch{}return {...memory};}
  function write(value){memory=value;try{storage?.setItem(key,JSON.stringify(value));}catch{}}
  function result(state,cached){return {currentVersion:version,latestVersion:state.latestVersion||null,available:valid(state.latestVersion)&&newer(state.latestVersion),cached,error:state.error||null,installUrl,releaseUrl,dismissed:state.dismissedVersion===state.latestVersion&&state.dismissedUntil>now()};}
  async function check(force=false){
    if(pending)return pending;
    const state=read(),time=now();
    if(!force&&Number.isFinite(state.nextCheck)&&state.nextCheck>time&&state.nextCheck-time<=interval)return result(state,true);
    pending=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{
        const response=await fetchImpl(manifestUrl,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache',signal:controller.signal});
        if(!response.ok)throw new Error('无法读取更新信息');
        const data=await response.json();if(!valid(data?.version))throw new Error('更新信息格式无效');
        const next={...read(),latestVersion:data.version,checkedAt:time,nextCheck:time+interval,error:null};write(next);return result(next,false);
      }catch{
        const next={...read(),nextCheck:time+retry,error:'暂时无法检查更新，请稍后重试。'};write(next);return result(next,false);
      }finally{clearTimeout(timer);pending=null;}
    })();
    return pending;
  }
  function dismiss(latestVersion){write({...read(),dismissedVersion:latestVersion,dismissedUntil:now()+24*60*60*1000});}
  return {check,dismiss};
}
