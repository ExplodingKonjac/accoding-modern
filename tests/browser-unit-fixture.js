// Local demo only. No real contest data or outgoing API requests.
(() => {
  const now=Date.now(), accepted=[3,2,1,0], total=[5,4,2,1];
  window.__amUnitDemo={stage:0};
  window.fetch=async input=>{
    const path=new URL(String(input),location.origin).pathname;
    let result;
    if(path.endsWith('/server_time'))result={server_time:new Date().toISOString()};
    else if(path.endsWith('/rank')){
      const rows=Array.from({length:8},(_,i)=>({user:{id:i+1},detail:Object.fromEntries(total.flatMap((n,p)=>i<n?[[String.fromCharCode(65+p),{result:i<accepted[p]?'AC':'WA',wrong_count:0}]]:[]))}));
      if(__amUnitDemo.stage){
        rows[3].detail.A={result:'AC',wrong_count:1};
        rows[5].detail.A={result:'AC',wrong_count:0};
        rows[6].detail.A={result:'AC',wrong_count:0};
        rows[4].detail.B={result:'WA',wrong_count:0};
        rows[5].detail.B={result:'WA',wrong_count:1};
        rows[2].detail.C={result:null,wrong_count:0};
      }
      if(__amUnitDemo.stage===2)rows[2].detail.C={result:'AC',wrong_count:0};
      result=JSON.stringify(rows);
    }else if(path.endsWith('/999'))result={id:999,title:'+1 模式演示 · 模拟数据',start_time:new Date(now-3600000).toISOString(),end_time:new Date(now+3600000).toISOString(),problems:accepted.map((_,i)=>({id:i+1,title:['判定通过：仅 +1','判定未通过：仅 -','待评测：无符号','暂无新增'][i],contest_problem_list:{order:i}}))};
    else throw Error('Unexpected demo request: '+path);
    return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});
  };
})();
