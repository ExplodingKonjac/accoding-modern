import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const script=await readFile(new URL('../src/review-access.js',import.meta.url),'utf8');
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
test('loading reviewer helpers has no credential, account or network side effects',()=>{
  const calls=[];
  vm.runInContext(script,profileContext(async url=>{calls.push(url);throw Error('unexpected request');}));
  assert.deepEqual(calls,[]);
  assert.doesNotMatch(script,/\/access\/(?:challenge|verify|combine)|ensureReviewAccess|expandReviewAccess|localStorage|sessionStorage/);
});

function writeContext({storage=new Map(),expires=Date.now()/1000+3600,protocol='oj-review-write-proof-v2'}={}){
  const calls=[],core={sourceVariants:text=>[text]},state={user:'123',name:'测试助教',loggedIn:true};
  const context=vm.createContext({Map,Set,Number,Date,Error,Promise,TextEncoder,Uint8Array,AbortSignal,URL,crypto:webcrypto,core,
    GM_getValue:async key=>storage.get(key),GM_setValue:async(key,value)=>storage.set(key,value),
    DOMParser:class{parseFromString(text){return text==='HOME'?{querySelector:()=>state.loggedIn?{}:null,querySelectorAll:()=>[{textContent:'欢迎，'+state.name,getAttribute:()=>'/user/'+state.user+'/index'}]}:{querySelector:()=>({textContent:'int main() {\r\n  return 0;\r}\n'})};}},
    fetch:async(url,init)=>{
      calls.push({url,init});if(url==='/')return {ok:true,text:async()=>'HOME'};if(url.startsWith('/submission/'))return {ok:true,text:async()=>'CODE'};
      if(url.endsWith('/write-access/challenge'))return {ok:true,json:async()=>({challenge_id:'one',nonce:'nonce',submission_ids:['11','12','13'],protocol,normalization:'newlines-lf-v1'})};
      assert.ok(url.endsWith('/write-access/verify'));return {ok:true,json:async()=>({token:'write-'+state.user,contest_id:JSON.parse(calls.findLast(call=>call.url.endsWith('/challenge')).init.body).contest_id,expires,reviewer_id:'oj-access-'+state.user,proof_protocol:protocol})};
    }});vm.runInContext(script,context);return {calls,context,state,storage};
}
test('write proof is lazy, domain-separated, newline-normalized and reused from GM storage across pages',async()=>{
  const {calls,context,storage}=writeContext();assert.equal(calls.length,0);
  assert.equal(await vm.runInContext('ensureReviewWriteAccess(1327,core)',context),'write-123');
  const proof=calls.find(call=>call.url.endsWith('/verify')),answers=JSON.parse(proof.init.body).answers;
  const digest=async text=>Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
  const expected=await digest('nonce:'+await digest('oj-review-write-proof-v2\nint main() {\n  return 0;\n}\n'));
  assert.deepEqual(answers,[[expected],[expected],[expected]]);
  assert.ok(calls.filter(call=>call.url.startsWith('https:')).every(call=>call.init.credentials==='omit'&&!call.init.headers.Authorization));
  assert.ok([...storage.keys()].every(key=>key.startsWith('accoding-modern.review-write.v2.123.1327')));
  const next=writeContext({storage});assert.equal(await vm.runInContext('ensureReviewWriteAccess(1327,core)',next.context),'write-123');assert.deepEqual(next.calls.map(call=>call.url),['/'],'cache reuse verifies actual current OJ login only when saving');
  await vm.runInContext('ensureReviewWriteAccess(1319,core)',next.context);assert.equal(next.calls.filter(call=>call.url.endsWith('/challenge')).length,1,'another contest cannot reuse prior scope');
});
test('writer cache rejects expired or legacy proof sessions and is isolated across current OJ accounts',async()=>{
  const storage=new Map([['accoding-modern.review-write.v2.123.1327',{token:'legacy',contest_id:1327,reviewer_id:'oj-access-123',expires:Date.now()/1000+3600}]]),testcase=writeContext({storage});
  await vm.runInContext('ensureReviewWriteAccess(1327,core)',testcase.context);assert.equal(testcase.calls.filter(call=>call.url.endsWith('/verify')).length,1);
  testcase.state.user='456';assert.equal(await vm.runInContext('ensureReviewWriteAccess(1327,core)',testcase.context),'write-456');assert.equal(testcase.calls.filter(call=>call.url.endsWith('/verify')).length,2);
  testcase.state.loggedIn=false;await assert.rejects(()=>vm.runInContext('ensureReviewWriteAccess(1327,core)',testcase.context),/登录 OJ/);
  const expired=writeContext({storage:new Map([['accoding-modern.review-write.v2.123.1327',{token:'expired',contest_id:1327,reviewer_id:'oj-access-123',proof_protocol:'oj-review-write-proof-v2',expires:1}]])});
  assert.equal(await vm.runInContext('ensureReviewWriteAccess(1327,core)',expired.context),'write-123');assert.equal(expired.calls.filter(call=>call.url.endsWith('/verify')).length,1);
});
test('write session invalidation removes only matching GM bearer and re-verifies once requested',async()=>{
  const {context,calls,storage}=writeContext();await vm.runInContext('ensureReviewWriteAccess(1327,core)',context);
  await vm.runInContext("invalidateReviewWriteAccess(1327,'other-session')",context);assert.ok(storage.get('accoding-modern.review-write.v2.123.1327'));
  await vm.runInContext("invalidateReviewWriteAccess(1327,'write-123')",context);assert.equal(storage.get('accoding-modern.review-write.v2.123.1327'),null);
  await vm.runInContext('ensureReviewWriteAccess(1327,core)',context);assert.equal(calls.filter(call=>call.url.endsWith('/verify')).length,2);
});
test('writer supports safe memory-only fallback and rejects unknown proof protocol before reading sources',async()=>{
  const testcase=writeContext();delete testcase.context.GM_getValue;delete testcase.context.GM_setValue;
  await vm.runInContext('ensureReviewWriteAccess(1327,core)',testcase.context);await vm.runInContext('ensureReviewWriteAccess(1327,core)',testcase.context);assert.equal(testcase.calls.filter(call=>call.url.endsWith('/verify')).length,1);
  const invalid=writeContext({protocol:'old-proof'});await assert.rejects(()=>vm.runInContext('ensureReviewWriteAccess(1327,core)',invalid.context),/协议无效/);assert.equal(invalid.calls.filter(call=>call.url.startsWith('/submission')).length,0);
});

test('write session lifetime is capped at eight hours and concurrent saves share one challenge',async()=>{
  const testcase=writeContext({expires:Date.now()/1000+86400});
  const values=await vm.runInContext('Promise.all([ensureReviewWriteAccess(1327,core),ensureReviewWriteAccess(1327,core)])',testcase.context);
  assert.deepEqual([...values],['write-123','write-123']);assert.equal(testcase.calls.filter(call=>call.url.endsWith('/challenge')).length,1);
  const saved=testcase.storage.get('accoding-modern.review-write.v2.123.1327');assert.ok(saved.expires<=Date.now()/1000+8*3600);assert.ok(saved.expires>Date.now()/1000+7.99*3600);
});
