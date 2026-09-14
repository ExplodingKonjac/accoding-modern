export function createContestCore() {
  const decode = value => {
    for (let i = 0; i < 2 && typeof value === 'string'; i++) value = JSON.parse(value);
    return value;
  };
  const time = value => {
    if (typeof value !== 'string' || !value.trim()) return NaN;
    // The API returns UTC ISO strings. Legacy timestamps use the site's Beijing timezone.
    const iso = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(value)
      ? value.replace(' ', 'T') + '+08:00' : value;
    return Date.parse(iso);
  };
  const letters = index => {
    let label = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
    return label;
  };
  // Preserve the old site's rank-key convention, including its numbering after Z.
  const rankKey = index => {
    if (!index) return 'A';
    let value = '';
    while (index > 0) { value = String.fromCharCode(65 + index % 26) + value; index = Math.floor(index / 26); }
    return value;
  };
  function normalizeContest(raw) {
    const c = decode(raw);
    if (!c || !Array.isArray(c.problems)) throw new Error('赛事数据格式不匹配');
    const start = time(c.start_time), end = time(c.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('赛事起止时间无效');
    const seen = new Set();
    const problems = [...c.problems].sort((a,b) => Number(a.contest_problem_list?.order) - Number(b.contest_problem_list?.order)).map((p,index) => {
      if (!Number.isFinite(Number(p.contest_problem_list?.order)) || !/^\d+$/.test(String(p.id)) || seen.has(String(p.id))) throw new Error('题目序号或 ID 无效');
      seen.add(String(p.id));
      return { id: String(p.id), title: String(p.title || '未命名题目'), label: letters(index), rankKey: rankKey(index) };
    });
    return {id:String(c.id),title:String(c.title || '未命名赛事'),start,end,problems};
  }
  function aggregateRank(raw, problems) {
    const rows = decode(raw);
    if (!Array.isArray(rows)) throw new Error('排行榜数据格式不匹配');
    const result = problems.map(p => ({...p,accepted:0,total:0}));
    const keys = new Map(result.map(p => [p.rankKey,p]));
    for (const row of rows) {
      if (!row || !row.detail || typeof row.detail !== 'object' || Array.isArray(row.detail)) throw new Error('排行榜明细格式不匹配');
      for (const [key,detail] of Object.entries(row.detail)) {
        const p = keys.get(key);
        if (!p) continue;
        // A missing detail means no attempt; a pending result still represents an attempt.
        if (detail == null) continue;
        if (typeof detail !== 'object' || Array.isArray(detail) || (detail.result != null && typeof detail.result !== 'string')) throw new Error('排行榜结果格式不匹配');
        p.total++;
        if (detail.result === 'AC') p.accepted++;
      }
    }
    return result;
  }
  function phase(contest, now) {
    if (now < contest.start) return {key:'upcoming',text:'比赛未开始',caption:'距离开始',remaining:contest.start-now};
    if (now < contest.end) return {key:'running',text:'比赛进行中',caption:'距离结束',remaining:contest.end-now};
    return {key:'finished',text:'比赛已结束',caption:'Contest finished',remaining:0};
  }
  function duration(ms) {
    const seconds=Math.max(0,Math.ceil(ms/1000));
    return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  }
  function scale(rows) {
    const max = Math.max(1,...rows.map(r=>r.total));
    const unit = Math.pow(10,Math.floor(Math.log10(max)));
    return Math.ceil(max / unit) * unit;
  }
  return {decode,time,letters,normalizeContest,aggregateRank,phase,duration,scale};
}
