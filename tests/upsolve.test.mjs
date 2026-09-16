import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpsolveCore} from '../src/upsolve-core.mjs';
const core=createUpsolveCore();
const contest={end:1000,problems:[{id:'1',rankKey:'A'},{id:'2',rankKey:'B'}]};
const base={rows:[{studentId:'001',userId:'10',status:'matched',details:{A:{result:'AC'}}},{studentId:'002',userId:'20',status:'matched',details:{}},{studentId:'003',userId:null,status:'missing',details:{}}]};
const sub=(id,user,p,result,t)=>({id:String(id),creator_id:String(user),problem_id:String(p),result,timestamp:t});
test('after-contest repeat AC is not a new upsolve; people and first success are deduplicated',()=>{
  const result=core.summarize(base,contest,[sub(1,10,1,'AC',1100),sub(2,10,2,'WA',1200),sub(3,10,2,'AC',1300),sub(4,10,2,'AC',1400),sub(3,10,2,'AC',1300)],2000);
  assert.equal(result.rows[0].during,1);assert.equal(result.rows[0].upsolved,1);assert.equal(result.rows[0].problems[1].first.id,'3');assert.equal(result.records.length,4);assert.equal(result.stats[0].upsolved,0);assert.equal(result.stats[1].upsolved,1);
});
test('end boundary is inclusive, deadline inclusive, precontest and future submissions excluded',()=>{
  const r=core.summarize(base,contest,[sub(1,20,1,'AC',999),sub(2,20,1,'AC',1000),sub(3,20,2,'AC',2000),sub(4,20,2,'AC',2001),sub(5,20,999,'AC',1500)],2000);
  assert.deepEqual(r.records.map(s=>s.id),['2','3']);assert.equal(r.rows[1].upsolved,2);
});
test('WA and pending do not count as acceptance; unmatched students remain unknown',()=>{
  const r=core.summarize(base,contest,[sub(1,20,1,'WA',1200),sub(2,20,2,'JG',1200)],2000);
  assert.equal(r.rows[1].unsolved,2);assert.equal(r.rows[2].unsolved,null);assert.equal(r.rows[2].problems[0].status,'unknown');
});
test('profile-verified student id can resolve a rank-absent user, nickname alone cannot',()=>{
  const submissions=[sub(1,30,1,'AC',1200)];
  assert.equal(core.summarize(base,contest,submissions,2000).rows[2].userId,null);
  const r=core.summarize(base,contest,submissions,2000,[{id:'30',studentId:'003'}]);assert.equal(r.rows[2].upsolved,1);
  const conflict=core.summarize(base,contest,submissions,2000,[{id:'30',studentId:'003'},{id:'31',studentId:'003'}]);assert.equal(conflict.rows[2].userId,null);
});
test('invalid deadline cannot produce zero upsolve totals',()=>{
  assert.throws(()=>core.summarize(base,contest,[],999));assert.throws(()=>core.summarize(base,contest,[],NaN));
});
test('upsolve leaderboard ranks new solves independently of contest scores, with shared ranks',()=>{
  const rows=[{studentId:'004',userId:'4',during:10,upsolved:0},{studentId:'002',userId:'2',during:1,upsolved:3},{studentId:'001',userId:'1',during:2,upsolved:3},{studentId:'000',userId:null,during:null,upsolved:null}];
  assert.deepEqual(core.standings(rows).map(m=>[m.studentId,m.ranking]),[['001',1],['002',1],['004',3],['000',null]]);
  assert.deepEqual(core.standings(rows,'total').map(m=>[m.studentId,m.ranking]),[['004',1],['001',2],['002',3],['000',null]]);
  assert.equal(rows[0].studentId,'004');
});
test('last upsolve time ignores repeated AC of a previously solved problem',()=>{
  const r=core.summarize(base,contest,[sub(1,10,2,'AC',1100),sub(2,10,2,'AC',1600),sub(3,10,1,'AC',1700)],2000);
  assert.equal(r.rows[0].lastUpsolved,1100);
});
