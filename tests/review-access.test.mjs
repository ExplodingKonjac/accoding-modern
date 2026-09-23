import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const script=await readFile(new URL('../src/review-access.js',import.meta.url),'utf8');
test('standalone source pages resolve the signed-in account name from OJ, not the navigation label',async()=>{
  const links=[{textContent:'个人信息',getAttribute:()=>'/user/123/index'},{textContent:'欢迎，测试助教',getAttribute:()=>'/user/123/index'}];
  const account={querySelectorAll:()=>links,querySelector:()=>({})};
  const empty={querySelectorAll:()=>[],querySelector:()=>null};
  const requests=[],issuedSession=webcrypto.randomUUID();
  const context=vm.createContext({document:empty,Map,Number,Date,Error,Promise,TextEncoder,Uint8Array,AbortSignal,crypto:webcrypto,
    DOMParser:class{parseFromString(text){return text==='HOME'?account:{querySelector:()=>({textContent:'source'})};}},
    fetch:async(url,init)=>{
      requests.push({url,init});
      if(url==='/')return {ok:true,text:async()=>'HOME'};
      if(url.startsWith('/submission/'))return {ok:true,text:async()=>'SOURCE'};
      if(url.endsWith('/access/challenge')){
        const data=JSON.parse(init.body);assert.equal(data.user_id,'123');assert.equal(data.display_name,'测试助教');
        return {ok:true,json:async()=>({challenge_id:'x',nonce:'n',submission_ids:['11','12','13']})};
      }
      assert.ok(url.endsWith('/access/verify'));
      const proofs=JSON.parse(init.body).answers;assert.equal(proofs.length,3);assert.ok(proofs.every(x=>/^[a-f0-9]{64}$/.test(x[0])));
      return {ok:true,json:async()=>({token:issuedSession,contest_id:1309,expires:Date.now()/1000+3600})};
    }});
  const result=await vm.runInContext(script+';ensureReviewAccess(1309,{sourceVariants:()=>["source"]})',context);
  assert.equal(result,issuedSession);
  assert.ok(requests.filter(r=>r.url.startsWith('https://')).every(r=>r.init.credentials==='omit'&&!('Cookie' in r.init.headers)));
});

function profileContext(fetcher){
  return vm.createContext({Map,Number,Date,Error,Promise,TextEncoder,Uint8Array,AbortSignal,URL,crypto:webcrypto,
    DOMParser:class{parseFromString(text){return {querySelectorAll:selector=>selector==='h3'?[{textContent:text}]:[]};}},fetch:fetcher});
}
test('legacy feedback resolves the author ID, never the currently logged-in reviewer, and coalesces profile reads',async()=>{
  const calls=[],context=profileContext(async(url,options)=>{calls.push({url,options});return {ok:true,url:'https://accoding.buaa.edu.cn:4000'+url,text:async()=>'Expert\n杨睿彬'};});
  const names=await vm.runInContext(script+`;Promise.all([reviewHistoryName({reviewer_id:'oj-access-86602',reviewer_name:'OJ 用户 86602'}),reviewHistoryName({reviewer_id:'oj-access-86602',reviewer_name:'OJ 用户 86602'})])`,context);
  assert.deepEqual([...names],['杨睿彬','杨睿彬']);assert.equal(calls.length,1);assert.equal(calls[0].url,'/user/86602/index');assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(await vm.runInContext(`reviewHistoryName({reviewer_id:'oj-access-86602',reviewer_name:'OJ 用户 86602'})`,context),'杨睿彬');assert.equal(calls.length,1);
});
test('real historical names and provisioned reviewer IDs are preserved without profile requests',async()=>{
  const context=profileContext(async()=>{throw Error('must not fetch');});
  const names=await vm.runInContext(script+`;Promise.all([reviewHistoryName({reviewer_id:'oj-access-86602',reviewer_name:'原有姓名'}),reviewHistoryName({reviewer_id:'ta-one',reviewer_name:'课程助教'})])`,context);
  assert.deepEqual([...names],['原有姓名','课程助教']);
});
test('failed and redirected profile reads keep the stored ID and can retry later',async()=>{
  let count=0;const context=profileContext(async url=>({ok:true,url:++count===1?'https://accoding.buaa.edu.cn:4000/user/login':'https://accoding.buaa.edu.cn:4000'+url,text:async()=>'Expert\n正确姓名'}));
  vm.runInContext(script,context);const expression=`reviewHistoryName({reviewer_id:'oj-access-86602',reviewer_name:'OJ 用户 86602'})`;
  assert.equal(await vm.runInContext(expression,context),'OJ 用户 86602');assert.equal(await vm.runInContext(expression,context),'正确姓名');
});
test('account selection ignores other users in page content and handles the themed personal link',()=>{
  const link=(id,textContent)=>({textContent,getAttribute:()=>'/user/'+id+'/index'});
  const context=profileContext(async()=>{});context.doc={querySelector:()=>({}),querySelectorAll:()=>[link(1,'学生甲'),link(123,'○ 个人信息')]};
  const account=vm.runInContext(script+';reviewAccount(doc)',context);assert.equal(account.userId,'123');assert.equal(account.name,'');
});
test('missing greeting reads the signed-in profile before issuing a cloud challenge',async()=>{
  const context=profileContext(async(url,init)=>{
    if(url==='/user/123/index')return {ok:true,url:'https://accoding.buaa.edu.cn:4000'+url,text:async()=>'Expert\n正确助教'};
    assert.ok(url.endsWith('/access/challenge'));assert.equal(JSON.parse(init.body).display_name,'正确助教');throw Error('challenge-name-verified');
  });
  context.document={querySelector:()=>({}),querySelectorAll:()=>[{textContent:'个人信息',getAttribute:()=>'/user/123/index'}]};
  await assert.rejects(()=>vm.runInContext(script+';ensureReviewAccess(1309,{})',context),/challenge-name-verified/);
});
