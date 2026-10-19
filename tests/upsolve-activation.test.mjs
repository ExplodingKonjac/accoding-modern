import test from 'node:test';
import assert from 'node:assert/strict';
import {createContestCore} from '../src/contest-core.mjs';
import {createUpsolveActivation} from '../src/upsolve-activation-core.mjs';

function fixture(options={}){
 const now=Date.parse('2026-10-19T00:00:00Z'),levels=new Map([['1','private'],['2','protect'],['3','public']]),writes=[];
 const problem=(id,group_id=124)=>({id,group_id,title:'题目'+id,contest_problem_list:{order:id}});
 const contest={id:1326,group_id:124,title:'已结束比赛',start_time:new Date(now-7200000).toISOString(),end_time:new Date(now-3600000).toISOString(),problems:[problem(1),problem(2),problem(3)]};
 let reads=0;
 const io={readContest:async id=>{reads++;if(options.onRead)return options.onRead(id,reads,contest);return contest;},readServerTime:async()=>({server_time:options.server??new Date(now).toISOString()}),
  readGroupProblems:async()=>[...levels].map(([id,access])=>({id,access})),readGroupContests:async()=>[1326],
  savePermissions:async(group,rows)=>{writes.push({group,rows});for(const p of rows)levels.set(p.id,p.access);}};
 Object.assign(io,options.io);
 return {now,levels,writes,contest,io,service:createUpsolveActivation(createContestCore(),io),problem};
}
test('only personal-private contest problems change; public and protected rows stay unchanged',async()=>{
 const f=fixture(),report=await f.service.run(1326);assert.equal(report.success.length,1);assert.equal(report.skipped.length,2);assert.deepEqual(f.writes,[{group:'124',rows:[{id:'1',access:'protect'}]}]);
 const repeat=await f.service.run(1326);assert.equal(repeat.success.length,0);assert.equal(repeat.skipped.length,3);assert.equal(f.writes.length,1);
});
for(const phase of ['upcoming','running'])test(phase+' contests never write, regardless of UI state',async()=>{
 const f=fixture();f.contest.start_time=new Date(f.now+(phase==='upcoming'?10000:-10000)).toISOString();f.contest.end_time=new Date(f.now+20000).toISOString();
 await assert.rejects(f.service.run(1326),/不能开启补题/);assert.equal(f.writes.length,0);
});
test('the exact server end boundary permits activation',async()=>{const f=fixture();f.contest.end_time=new Date(f.now).toISOString();assert.equal((await f.service.run(1326)).success.length,1);});
test('missing server time never falls back to the local clock',async()=>{const f=fixture({server:'bad-time'});await assert.rejects(f.service.run(1326),/服务器时间/);assert.equal(f.writes.length,0);});
test('a contest extended during the final permission read is blocked',async()=>{
 const f=fixture();let count=0;const original=f.io.readGroupProblems;f.io.readGroupProblems=async()=>{if(++count===2)f.contest.end_time=new Date(f.now+10000).toISOString();return original();};
 await assert.rejects(f.service.run(1326),/进行中/);assert.equal(f.writes.length,0);
});
test('same-group unfinished contest reuse is skipped',async()=>{
 const f=fixture();f.io.readGroupContests=async()=>[1326,1329];f.io.readContest=async id=>String(id)==='1326'?f.contest:{...f.contest,id:1329,title:'未来比赛',end_time:new Date(f.now+10000).toISOString()};
 const report=await f.service.run(1326);assert.equal(f.writes.length,0);assert.ok(report.skipped.some(p=>p.reason.includes('未来比赛')));
});
test('an unreadable comparison contest stops activation',async()=>{
 const f=fixture();f.io.readGroupContests=async()=>[1326,1329];f.io.readContest=async id=>{if(String(id)!=='1326')throw Error('无权限');return f.contest;};
 await assert.rejects(f.service.run(1326),/无权限/);assert.equal(f.writes.length,0);
});
test('routing away during preflight prevents writes',async()=>{const f=fixture();await assert.rejects(f.service.run(1326,{isCurrent:()=>false}),/切换比赛/);assert.equal(f.writes.length,0);});
test('a timed-out partial commit is read back without retrying the POST',async()=>{
 const f=fixture();f.levels.set('2','private');f.io.savePermissions=async(group,rows)=>{f.writes.push(rows);f.levels.set('1','protect');throw Error('请求超时');};
 const report=await f.service.run(1326);assert.equal(report.success.length,1);assert.equal(report.failed.length,1);assert.match(report.failed[0].reason,/超时/);assert.equal(f.writes.length,1);
});
test('failed readback never claims success or retries the mutation',async()=>{
 const f=fixture(),original=f.io.readGroupProblems;f.io.readGroupProblems=async()=>{if(f.writes.length)throw Error('断网');return original();};
 const report=await f.service.run(1326);assert.equal(report.success.length,0);assert.match(report.failed[0].reason,/无法核验/);assert.equal(f.writes.length,1);
});
test('management permissions and contest identity are required',async()=>{
 const f=fixture();f.io.readGroupProblems=async()=>{throw Error('没有管理权限');};await assert.rejects(f.service.run(1326),/管理权限/);assert.equal(f.writes.length,0);
 const g=fixture();g.contest.id=1327;await assert.rejects(g.service.run(1326),/ID 不匹配/);assert.equal(g.writes.length,0);
});
