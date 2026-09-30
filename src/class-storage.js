function createClassStorage(local,shared={}) {
  const key='accoding-modern.classes.v1';
  const empty={version:1,classes:[]};
  const parse=value=>{
    const data=typeof value==='string'?JSON.parse(value):value;
    if(!data||data.version!==1||!Array.isArray(data.classes)||data.classes.some(entry=>!entry.id||!entry.name||!Array.isArray(entry.members)))throw new Error('名册格式无效');
    return data;
  };
  const revision=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const sharedRead=()=>shared.get?.(key,null);
  let currentRevision=null;
  function load() {
    const localData=parse(local.getItem(key)||empty);
    if(!shared.get||!shared.set)return localData.classes;
    const stored=sharedRead();
    const sharedData=stored==null?null:parse(stored);
    let data=sharedData;
    if(!data) data=localData.classes.length?{version:1,classes:localData.classes,syncRevision:revision()}:null;
    else if(localData.classes.length&&!localData.syncRevision){
      const merged=new Map(data.classes.map(entry=>[entry.id,entry]));
      for(const entry of localData.classes){
        const existing=merged.get(entry.id);
        if(existing&&JSON.stringify(existing)!==JSON.stringify(entry))throw new Error('直连与 VPN 的同名册存在不同版本，请先分别导出备份并手动核对。');
        merged.set(entry.id,entry);
      }
      if(merged.size!==data.classes.length)data={version:1,classes:[...merged.values()],syncRevision:revision()};
    }else if(localData.syncRevision===data.syncRevision&&JSON.stringify(localData.classes)!==JSON.stringify(data.classes)){
      throw new Error('本地名册与同步副本不一致，请先备份并核对。');
    }
    if(data){
      if(!data.syncRevision)data={version:1,classes:data.classes,syncRevision:revision()};
      if(JSON.stringify(data)!==JSON.stringify(sharedData))shared.set(key,JSON.stringify(data));
      if(JSON.stringify(data)!==JSON.stringify(localData))local.setItem(key,JSON.stringify(data));
      currentRevision=data.syncRevision;
      return data.classes;
    }
    return localData.classes;
  }
  function save(classes) {
    if(shared.get&&shared.set){
      if((parse(sharedRead()||empty).syncRevision||null)!==currentRevision)throw new Error('其他页面已修改班级名册，请刷新后重试，避免覆盖。');
      const data={version:1,classes,syncRevision:revision()};
      shared.set(key,JSON.stringify(data));
      local.setItem(key,JSON.stringify(data));
      currentRevision=data.syncRevision;
    }else local.setItem(key,JSON.stringify({version:1,classes}));
  }
  return {key,load,save};
}
