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

function unionContext({failIds=[],combineFails=false}={}){
  const calls=[],links=[{textContent:'欢迎，测试助教',getAttribute:()=>'/user/123/index'}],group=[1,2,3],core={sourceVariants:()=>['source'],courseContests:()=>group.map(id=>({id})),collectedContests:()=>[...group,4].map(id=>({id}))};
  const context=vm.createContext({document:{querySelector:()=>({}),querySelectorAll:()=>links},Map,Number,Date,Error,Promise,TextEncoder,Uint8Array,AbortSignal,crypto:webcrypto,core,
    DOMParser:class{parseFromString(){return {querySelector:()=>({textContent:'source'})};}},fetch:async(url,init)=>{
      const body=init?.body?JSON.parse(init.body):null;calls.push({url,init,body});if(url.startsWith('/submission/'))return {ok:true,text:async()=>'SOURCE'};
      if(url.endsWith('/challenge'))return failIds.includes(body.contest_id)?{ok:false,json:async()=>({detail:'没有读取权限'})}:{ok:true,json:async()=>({challenge_id:String(body.contest_id),nonce:'nonce',submission_ids:['11','12','13']})};
      if(url.endsWith('/verify'))return {ok:true,json:async()=>({contest_id:Number(body.challenge_id),token:'proof-'+body.challenge_id,expires:Date.now()/1000+3600})};
      assert.ok(url.endsWith('/combine'));return combineFails?{ok:false,json:async()=>({detail:'合并失败'})}:{ok:true,json:async()=>({token:'combined',contest_ids:body.tokens.map(token=>Number(token.slice(6))),expires:Date.now()/1000+3600})};
    }});vm.runInContext(script,context);return {context,calls};
}

test('cross-contest access combines only successfully verified proof tokens and caches source proofs',async()=>{
  const {context,calls}=unionContext({failIds:[3]});assert.equal(await vm.runInContext('ensureReviewAccess(1,core)',context),'combined');
  const combined=calls.find(call=>call.url.endsWith('/combine'));assert.deepEqual(combined.body.tokens,['proof-1','proof-2','proof-4']);
  const coverage=vm.runInContext('reviewAccessCoverage.get(1)',context);assert.deepEqual([...coverage.verified_ids],[1,2,4]);assert.deepEqual([...coverage.failed_ids],[3]);
  const firstReads=calls.filter(call=>call.url.startsWith('/submission/')).length;
  assert.equal(await vm.runInContext('ensureReviewAccess(1,core)',context),'combined');assert.equal(calls.filter(call=>call.url.startsWith('/submission/')).length,firstReads);
  assert.equal(calls.filter(call=>call.url.endsWith('/combine')).length,1);
  assert.ok(calls.filter(call=>call.url.startsWith('https://')).every(call=>call.init.credentials==='omit'&&!('Cookie' in call.init.headers)));
});

test('one valid proof or a failed combine retains the current contest scope',async()=>{
  const single=unionContext({failIds:[2,3,4]});assert.equal(await vm.runInContext('ensureReviewAccess(1,core)',single.context),'proof-1');assert.equal(single.calls.some(call=>call.url.endsWith('/combine')),false);
  const failure=unionContext({combineFails:true});const tokens=await vm.runInContext('Promise.all([ensureReviewAccess(1,core),ensureReviewAccess(2,core)])',failure.context);assert.deepEqual([...tokens],['proof-1','proof-2']);
  assert.equal(vm.runInContext('reviewAccessCoverage.get(1).combine_error',failure.context),true);
});
