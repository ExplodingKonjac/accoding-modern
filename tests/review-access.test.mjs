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
