// Development-only fixture: evaluate in a disposable browser task page, then reload to remove.
// This is not included in the userscript. No personal or real contest data.
(() => {
  const original=window.fetch.bind(window);
  const state={phase:'finished',fail:false,denyRank:false,calls:0,delay:0,acceptedGain:0};
  window.__amFixture=state;
  const ac=[1577,1283,1562,946,540,945,56,2,79,1,1];
  const total=[1598,1556,1591,1436,928,1280,302,250,157,12,44];
  const rank=Array.from({length:1598},(_,i)=>({detail:Object.fromEntries(total.flatMap((n,p)=>i<n?[[String.fromCharCode(65+p),{result:i<ac[p]?'AC':'WA',wrong_count:3}]]:[]))}));
  window.fetch=async(input,options)=>{
    const url=new URL(String(input),location.origin);
    if(!url.pathname.startsWith('/api/contests/'))return original(input,options);
    state.calls++;
    if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
    if(options?.signal?.aborted)throw new DOMException('Aborted','AbortError');
    if(state.fail)return new Response(JSON.stringify({error:'fixture failure'}),{status:503,headers:{'content-type':'application/json'}});
    const now=Date.now();let start=now-3*3600000,end=now-3600000;
    if(state.phase==='upcoming'){start=now+3600000;end=now+3*3600000;}
    if(state.phase==='running'){start=now-3600000;end=now+3600000;}
    const id=url.pathname.match(/\/contests\/(\d+)/)?.[1];
    let value;
    if(url.pathname.endsWith('/server_time'))value={server_time:new Date(now).toISOString()};
    else if(url.pathname.endsWith('/rank')){
      if(state.denyRank)return new Response('{}',{status:403,headers:{'content-type':'application/json'}});
      const updated=rank.map((row,i)=>({detail:{...row.detail,...(i>=ac[0]&&i<Math.min(total[0],ac[0]+state.acceptedGain)?{A:{result:'AC',wrong_count:3}}:{})}}));
      value=JSON.stringify(state.phase==='upcoming'?[]:updated);
    }else value={id,title:'示例编程赛 · 模拟数据',start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),problems:ac.map((_,i)=>({id:i+1,title:'示例题目 '+String.fromCharCode(65+i),contest_problem_list:{order:i}})).reverse()};
    return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
  };
})();
