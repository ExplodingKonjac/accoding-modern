import test from 'node:test';
import assert from 'node:assert/strict';
import {createClassCore} from '../src/class-core.mjs';
const core=createClassCore();
test('class members sort by in-contest solved count, then student number; unmatched last',()=>{
  const rows=[{studentId:'002',userId:'2',accepted:3},{studentId:'000',userId:null,accepted:null},{studentId:'003',userId:'3',accepted:10},{studentId:'001',userId:'1',during:3,upsolved:7}];
  assert.deepEqual(core.sortMembers(rows).map(r=>r.studentId),['003','001','002','000']);
  assert.equal(rows[0].studentId,'002');
});
test('teaching roster header may follow metadata; only required columns survive',()=>{
  const result=core.roster([['点名册'],['2026秋'],['序号','学号','姓名','联系电话','班级'],[1,'00123456',' 张三 ','123456789','C1'],[2,'00123456','张三','secret','C1']]);
  assert.deepEqual(result.members,[{studentId:'00123456',name:'张三',group:'C1'}]);assert.equal(result.warnings.length,1);
});
test('conflicting student numbers and invalid roster fail rather than silently merging',()=>{
  assert.throws(()=>core.roster([['学号','姓名'],['123','甲'],['123','乙']]),/重复/);
  assert.throws(()=>core.roster([['学号','姓名'],['','甲']]),/有效学生/);
  assert.throws(()=>core.roster([['姓名'],['甲']]),/找不到/);
});
const members=[{studentId:'001',name:'同名'},{studentId:'002',name:'同名'},{studentId:'003',name:'未知'},{studentId:'004',name:'冲突'}];
const problems=[{id:'99',rankKey:'A'},{id:'98',rankKey:'B'}];
test('exact student numbers determine class membership; no nickname fallback',()=>{
  const result=core.summarize(members,[{user:{id:1,student_id:'001'},detail:{A:{result:'AC'},B:{result:'JG'}}},{user:{id:2,student_id:'002'},detail:{A:{result:'WA',wrong_count:100}}},{user:{id:9,student_id:'999',nickname:'未知'},detail:{B:{result:'AC'}}}],problems);
  assert.equal(result.matched,2);assert.equal(result.missing,2);assert.deepEqual(result.stats.map(p=>[p.accepted,p.tried]),[[1,2],[0,1]]);assert.equal(result.rows[2].accepted,null);
});
test('duplicate accounts with the same student number are excluded from totals',()=>{
  const result=core.summarize(members,[{user:{id:1,student_id:'004'},detail:{A:{result:'AC'}}},{user:{id:2,student_id:'004'},detail:{A:{result:'AC'}}}],problems);
  assert.equal(result.ambiguous,1);assert.equal(result.matched,0);assert.equal(result.stats[0].accepted,0);
});
test('unavailable rank is an error; valid empty rank keeps members unresolved',()=>{
  assert.throws(()=>core.summarize(members,{error:'denied'},problems));
  const result=core.summarize(members,[],problems);assert.equal(result.missing,4);assert.equal(result.rows[0].accepted,null);
});
test('submission selection uses account id, deduplicates and orders newest first',()=>{
  const rows=core.submissions([{id:1,creator_id:1},{id:2,creator:{id:1}},{id:3,creator_id:2},{id:2,creator_id:1}],'1');
  assert.deepEqual(rows.map(r=>r.id),[2,1]);
});
test('problem AC selection uses matched class accounts and exact problem IDs, keeps all AC attempts newest first',()=>{
  const students=[{studentId:'001',name:'同名',status:'matched',userId:'1'},{studentId:'002',name:'同名',status:'matched',userId:'2'},{studentId:'003',status:'ambiguous',userId:'3'},{studentId:'004',status:'missing',userId:null}];
  const raw=[
    {id:1,creator_id:1,problem_id:99,result:'AC'},
    {id:2,creator:{id:2},problem_id:'99',result:'AC'},
    {id:3,creator_id:'1',problem_id:'99',result:'AC'},
    {id:'3',creator_id:1,problem_id:99,result:'AC'},
    {id:4,creator_id:1,problem_id:99,result:'WA'},
    {id:5,creator_id:1,problem_id:99,result:'JG'},
    {id:6,creator_id:1,problem_id:98,result:'AC'},
    {id:7,creator_id:9,problem_id:99,result:'AC'},
    {id:8,creator_id:3,problem_id:99,result:'AC'},
    {id:9,creator_id:null,problem_id:99,result:'AC'},
    {id:'invalid',creator_id:1,problem_id:99,result:'AC'}
  ];
  assert.deepEqual(core.problemSubmissions(raw,students,'99').map(r=>[r.submission.id,r.member.studentId]),[[3,'001'],[2,'002'],[1,'001']]);
  assert.equal(raw[0].id,1);
  assert.deepEqual(core.problemSubmissions(raw,students,'100'),[]);
  assert.deepEqual(core.problemSubmissions(raw,[],'99'),[]);
  assert.throws(()=>core.problemSubmissions({error:'denied'},students,'99'),/格式/);
});
