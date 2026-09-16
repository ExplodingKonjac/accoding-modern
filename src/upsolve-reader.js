function createUpsolveReader(time) {
  const verdicts={Accepted:'AC','Wrong Answer':'WA','Compile Error':'CE','Time Limit Exceed':'TLE','Time Limit Exceeded':'TLE','Memory Limit Exceed':'MLE','Memory Limit Exceeded':'MLE','Presentation Error':'PE',Waiting:'WT',Running:'JG','Runtime Error (SIGSEGV)':'REG','Runtime Error (SIGFPE)':'REP','Other Error':'OE','Judge Error':'ERR','Input File Not Ready':'IFNR','Output File Not Ready':'OFNR'};
  function parsePage(html, problemId, offset) {
    const doc=new DOMParser().parseFromString(html,'text/html');
    if (!doc.querySelector('.submission-table') || doc.querySelector('#problem_id')?.value!==String(problemId)) throw new Error('提交列表不可用，请检查登录或查询权限。');
    const rows=[...doc.querySelectorAll('.submission-table tr[id^="tr"]')].map(tr=>{
      const cells=tr.querySelectorAll('td'), id=tr.querySelector('[id^="submission_id"]')?.textContent.trim();
      const creator=cells[1]?.querySelector('a')?.getAttribute('href')?.match(/\/user\/(\d+)\/index/)?.[1];
      const pid=cells[2]?.querySelector('a')?.getAttribute('href')?.match(/\/problem\/(\d+)\/index/)?.[1];
      const created=tr.querySelector('.standard-format')?.textContent.trim(), timestamp=time(created);
      const resultText=tr.querySelector('[id^="submission_result"] label')?.textContent.trim();
      if(!/^\d+$/.test(id||'')||!creator||pid!==String(problemId)||!Number.isFinite(timestamp)||!resultText)throw new Error('提交列表格式不匹配，已停止查询。');
      return {id,creator_id:creator,nickname:cells[1].textContent.trim(),problem_id:pid,result:verdicts[resultText]||resultText,
        score:cells[4]?.textContent.trim(),lang:cells[5]?.textContent.trim(),created_at:new Date(timestamp).toISOString(),timestamp};
    });
    const nextNode=[...doc.querySelectorAll('[onclick]')].find(e=>e.textContent.trim()==='下一页');
    let next=null;
    if(nextNode){const match=nextNode.getAttribute('onclick').match(/change_page\(["']([^"']+)["']\)/);if(!match)throw new Error('无法识别提交分页。');
      const url=new URL(match[1],location.origin+'/submission/index');const n=Number(url.searchParams.get('offset'));
      if(url.origin!==location.origin||url.pathname!=='/submission/index'||!Number.isInteger(n)||n<=offset)throw new Error('提交分页异常。');next=n;}
    return {rows,next};
  }
  async function fetchText(url, options, signal) {
    const response=await fetch(url,{...options,credentials:'same-origin',cache:'no-store',signal});
    if(!response.ok)throw new Error(`补题查询失败（HTTP ${response.status}）。`);
    return response.text();
  }
  async function read(contest, base, until, signal, progress) {
    const records=[], seen=new Set();let pages=0;
    // Two workers limit load; each problem walks the site's observed offset pagination.
    let cursor=0, finished=0;
    async function worker(){
      while(cursor<contest.problems.length){
        const p=contest.problems[cursor++];let offset=0, oldest=Infinity;const fingerprints=new Set();
        for(let page=0;;page++){
          if(signal.aborted)throw new DOMException('已取消','AbortError');
          if(page>=1000)throw new Error('单题记录超过 1000 页，请缩小查询范围。');
          const html=await fetchText(`/submission/index?offset=${offset}`,{method:'POST',body:new URLSearchParams({problem_id:p.id,nickname:'',result:'',language:''})},signal);
          const parsed=parsePage(html,p.id,offset);pages++;progress({pages,finished,total:contest.problems.length});
          if(!parsed.rows.length)break;
          const fingerprint=parsed.rows.map(s=>s.id).join(',');
          if(fingerprints.has(fingerprint))throw new Error('原站重复返回同一页，补题查询未完成。');fingerprints.add(fingerprint);
          let reachedEnd=false;
          for(const s of parsed.rows){
            if(seen.has(s.id))continue;
            if(s.timestamp>oldest)throw new Error('提交时间顺序异常，补题查询未完成。');oldest=s.timestamp;seen.add(s.id);
            if(s.timestamp<contest.end){reachedEnd=true;continue;}
            if(s.timestamp<=until)records.push(s);
          }
          if(reachedEnd||parsed.next===null)break;
          offset=parsed.next;
        }
        finished++;progress({pages,finished,total:contest.problems.length});
      }
    }
    await Promise.all([worker(),worker()]);
    const known=new Set(base.rows.filter(m=>m.userId).map(m=>m.userId));
    const missing=base.rows.filter(m=>!m.userId&&m.status!=='ambiguous');
    const names=new Set(missing.map(m=>m.name));
    const candidates=new Map(records.filter(s=>!known.has(String(s.creator_id))&&names.has(s.nickname)).map(s=>[String(s.creator_id),s]));
    const identities=[];
    // A matching nickname only selects a profile to inspect; its student number is authoritative.
    for(const [id] of candidates){
      const doc=new DOMParser().parseFromString(await fetchText(`/user/${id}/index`,{},signal),'text/html');
      const field=[...doc.querySelectorAll('label.form-control-static')].map(e=>e.textContent.replace(/\s/g,'')).find(t=>/^学号[:：]/.test(t));
      const studentId=field?.replace(/^学号[:：]/,'').trim();if(studentId)identities.push({id,studentId});
    }
    return {records,identities,pages};
  }
  return {read,parsePage};
}
