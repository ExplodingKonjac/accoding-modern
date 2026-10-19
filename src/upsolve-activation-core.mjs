// All write paths pass through a fresh server-time check. The UI's disabled state
// is only feedback; it is never the authority for opening a contest's problems.
export function createUpsolveActivation(Core, io) {
  const idOf=value=>{
    if(!/^[1-9]\d*$/.test(String(value)))throw new Error('比赛、小组或题目 ID 无效。');
    return String(value);
  };
  async function check(id) {
    id=idOf(id);
    const [value,server]=await Promise.all([io.readContest(id),io.readServerTime()]);
    const raw=Core.decode(value),contest=Core.normalizeContest(raw),now=Core.time(server?.server_time);
    if(contest.id!==id)throw new Error('返回的比赛 ID 不匹配。');
    if(!Number.isFinite(now))throw new Error('无法读取服务器时间，暂不能开启补题。');
    return {raw,contest,now,phase:Core.phase(contest,now).key};
  }
  function assertFinished(state) {
    if(state.phase!=='finished')throw new Error(state.phase==='upcoming'?'比赛未开始，不能开启补题。':'比赛进行中，不能开启补题。');
  }
  async function run(id,{isCurrent=()=>true,onProgress=()=>{}}={}) {
    const initial=await check(id);assertFinished(initial);
    const group=idOf(initial.raw.group_id),result={success:[],skipped:[],failed:[]};
    const current=()=>{if(!isCurrent())throw new Error('已切换比赛，操作已停止。');};
    const groupProblems=await io.readGroupProblems(group);
    const levels=new Map(groupProblems.map(p=>[idOf(p.id),p.access]));
    const candidates=[];
    for(const problem of initial.contest.problems){
      const original=initial.raw.problems.find(p=>String(p.id)===problem.id);
      if(String(original.group_id)!==group){result.skipped.push({...problem,reason:'题目不属于本比赛小组'});continue;}
      const level=levels.get(problem.id);
      if(!level)throw new Error(`小组权限列表缺少题目 #${problem.id}，未修改权限。`);
      if(level!=='private')result.skipped.push({...problem,reason:level==='protect'?'已为组内可见':'已为所有人可见'});
      else candidates.push(problem);
    }
    if(!candidates.length)return result;
    current();onProgress('检查同组未结束比赛中的题目复用…');
    const contests=await io.readGroupContests(group),blocked=new Map();
    if(!contests.map(String).includes(String(id)))throw new Error('小组比赛列表缺少当前比赛，未修改权限。');
    // Read sequentially to avoid flooding the legacy OJ. An unreadable contest
    // stops the operation because its problem reuse cannot be determined.
    for(const otherId of contests){
      if(String(otherId)===String(id))continue;
      current();
      const other=Core.normalizeContest(await io.readContest(idOf(otherId)));
      if(other.id!==String(otherId))throw new Error('复用检查返回了其他比赛。');
      if(other.end>initial.now)for(const p of other.problems)blocked.set(p.id,`被未结束比赛「${other.title}」复用`);
    }
    let selected=candidates.filter(p=>{
      if(!blocked.has(p.id))return true;
      result.skipped.push({...p,reason:blocked.get(p.id)});return false;
    });
    if(!selected.length)return result;
    onProgress('再次核验比赛状态与题目权限…');
    const fresh=await check(id);assertFinished(fresh);current();
    if(String(fresh.raw.group_id)!==group)throw new Error('比赛所属小组已改变，请重新操作。');
    const freshProblems=new Map(fresh.raw.problems.map(p=>[String(p.id),p]));
    const latest=new Map((await io.readGroupProblems(group)).map(p=>[String(p.id),p.access]));
    selected=selected.filter(p=>{
      const actual=freshProblems.get(p.id),level=latest.get(p.id);
      if(!actual||String(actual.group_id)!==group||!level)throw new Error('比赛题目发生变化，请重新操作。');
      if(level==='private')return true;
      result.skipped.push({...p,reason:'权限已改变，无需修改'});return false;
    });
    if(!selected.length)return result;
    // Recheck after the final permissions read as well: an administrator may
    // extend the contest while the management page is loading.
    assertFinished(await check(id));current();
    onProgress(`正在开启 ${selected.length} 题的补题权限…`);
    let writeError;
    try{await io.savePermissions(group,selected.map(p=>({id:p.id,access:'protect'})));}
    catch(error){writeError=error;}
    // POST can partially succeed or time out after committing. Read back every
    // selected problem; never retry a write automatically or claim a rollback.
    let verified;
    try{verified=new Map((await io.readGroupProblems(group)).map(p=>[String(p.id),p.access]));}
    catch(error){for(const p of selected)result.failed.push({...p,reason:'保存后无法核验，请刷新查看权限后重试。'+error.message});return result;}
    for(const p of selected){
      if(verified.get(p.id)==='protect')result.success.push(p);
      else result.failed.push({...p,reason:writeError?.message||'保存后权限未变为组内可见，请检查管理权限。'});
    }
    return result;
  }
  return {check,run};
}
