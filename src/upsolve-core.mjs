export function createUpsolveCore() {
  function summarize(base, contest, submissions, until, identities = []) {
    if (!Number.isFinite(until) || until < contest.end) throw new Error('比赛尚未结束。');
    const problemIds = new Set(contest.problems.map(p => p.id));
    const seen = new Set();
    const records = submissions.filter(s => {
      if (!/^\d+$/.test(String(s.id)) || !Number.isFinite(s.timestamp)) throw new Error('补题提交数据无效。');
      if (seen.has(String(s.id))) return false; seen.add(String(s.id));
      return problemIds.has(String(s.problem_id)) && s.timestamp >= contest.end && s.timestamp <= until;
    }).sort((a,b) => a.timestamp - b.timestamp || Number(a.id) - Number(b.id));
    const byUser = new Map();
    for (const s of records) {const id=String(s.creator_id);if(!byUser.has(id))byUser.set(id,[]);byUser.get(id).push(s);}
    const rows = base.rows.map(m => {
      const candidates = new Set(identities.filter(i=>i.studentId===m.studentId).map(i=>String(i.id)));
      if(m.userId)candidates.add(m.userId);
      const userId=m.status!=='ambiguous' && candidates.size===1 ? [...candidates][0] : null;
      const own = userId ? byUser.get(userId)||[] : [];
      const problems = contest.problems.map(p => {
        const during=m.details[p.rankKey]?.result==='AC';
        const attempts=own.filter(s=>String(s.problem_id)===p.id);
        const first=attempts.find(s=>s.result==='AC');
        return {...p,status:!userId?'unknown':during?'during':first?'upsolved':'unsolved',first:first||null,attempts:attempts.length};
      });
      const completed=problems.filter(p=>p.status==='upsolved');
      return {...m,userId,status:userId?'matched':m.status,problems,
        lastUpsolved:completed.length?Math.max(...completed.map(p=>p.first.timestamp)):null,
        during:userId?problems.filter(p=>p.status==='during').length:null,
        upsolved:userId?problems.filter(p=>p.status==='upsolved').length:null,
        unsolved:userId?problems.filter(p=>p.status==='unsolved').length:null,
        postSubmissions:own.length};
    });
    const allowed=new Set(rows.filter(r=>r.userId).map(r=>r.userId));
    const stats=contest.problems.map((p,index)=>({...p,
      during:rows.filter(r=>r.problems[index].status==='during').length,
      upsolved:rows.filter(r=>r.problems[index].status==='upsolved').length,
      tried:rows.filter(r=>r.userId&&r.problems[index].attempts>0).length}));
    return {rows,stats,until,records:records.filter(s=>allowed.has(String(s.creator_id))),matched:allowed.size};
  }
  function standings(rows, order='upsolved') {
    const score=m=>order==='total'?(m.during||0)+(m.upsolved||0):(m.upsolved||0);
    const sorted=[...rows].sort((a,b)=>Number(!!b.userId)-Number(!!a.userId)||score(b)-score(a)||String(a.studentId).localeCompare(String(b.studentId),'en',{numeric:true}));
    let previous=null, rank=0;
    return sorted.map((m,index)=>{
      if(m.userId&&score(m)!==previous){rank=index+1;previous=score(m);}
      return {...m,ranking:m.userId?rank:null,total:m.userId?(m.during||0)+(m.upsolved||0):null};
    });
  }
  return {summarize,standings};
}
