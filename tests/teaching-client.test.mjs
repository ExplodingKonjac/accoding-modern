import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../src/teaching-client.js',import.meta.url),'utf8');
const origin='https://accoding.buaa.edu.cn:4000';
function groupDocument(rows,loggedIn=true){
  const heading={textContent:'可管理的所有小组',compareDocumentPosition:()=>4};
  const table={querySelectorAll:()=>rows.map(([id,name])=>({textContent:name,getAttribute:()=>'/group/'+id+'/index'}))};
  return {querySelectorAll:selector=>selector==='h1,h2,h3'?(loggedIn?[heading]:[]):selector==='table'?[table]:[]};
}
function environment(){
  const storage=new Map(),cached=new Map(),calls=[],state={userId:'42',now:1000000,loggedIn:true,fail:false};
  const caches={async open(name){if(!cached.has(name))cached.set(name,new Map());const rows=cached.get(name);return {async match(key){return rows.get(key)?.clone();},async put(key,value){rows.set(key,value.clone());}};},async delete(name){return cached.delete(name);}};
  function client(){
    const context=vm.createContext({URL,Response,Map,Promise,DOMException,Error,JSON,Object,String,Date:class extends Date{static now(){return state.now;}},location:{origin,href:origin+'/contest/index'},caches,document:{},
      GM_getValue:(key,fallback)=>storage.get(key)||fallback,GM_setValue:(key,value)=>storage.set(key,value),
      accodingPath:path=>path,accodingPagePath:url=>url.pathname,createContestCore:()=>({decode:value=>value}),
      reviewAccount:()=>state.loggedIn?{userId:state.userId}:null,
      DOMParser:class{parseFromString(){return groupDocument([[state.userId,'当前账号的组']],state.loggedIn);}},
      fetch:async(url,options)=>{calls.push({url:String(url),options});return state.fail?Response.json({detail:'读取失败'},{status:500}):Response.json({n:calls.length});}});
    return vm.runInContext(script+';createTeachingClient()',context);
  }
  return {client,calls,state,storage};
}
test('reading teaching data needs no service login and never sends old credentials',async()=>{
  const e=environment();e.storage.set('accoding-modern.teaching.connection.v1',JSON.stringify(Object.fromEntries([['token','test fixture'],['userId','42']])));
  await e.client().request('/bootstrap');assert.equal(e.calls.length,1);
  assert.ok(e.calls[0].url.endsWith('/bootstrap'));assert.equal(e.calls[0].options.headers.Authorization,undefined);assert.equal(e.calls[0].options.credentials,'omit');
});
test('GET cache survives reopening and page navigation, expires after five minutes and supports refresh',async()=>{
  const e=environment(),client=e.client();
  const first=await client.request('/members',{query:{course:'a',class_id:'1'}});
  assert.deepEqual(await client.request('/members',{query:{class_id:'1',course:'a'}}),first);
  assert.deepEqual(await e.client().request('/members',{query:{course:'a',class_id:'1'}}),first);assert.equal(e.calls.length,1);
  await client.request('/members',{query:{course:'b',class_id:'1'}});assert.equal(e.calls.length,2);
  e.state.now+=300001;await client.request('/members',{query:{course:'a',class_id:'1'}});assert.equal(e.calls.length,3);
  await client.clearCache();await client.request('/members',{query:{course:'a',class_id:'1'}});assert.equal(e.calls.length,4);
  await client.request('/members',{query:{course:'a',class_id:'1'},cache:false});assert.equal(e.calls.length,5);
});
test('OJ groups use the current browser session and cache each account separately',async()=>{
  const e=environment(),client=e.client();
  assert.equal((await client.groups())[0].id,'42');assert.equal((await e.client().groups())[0].id,'42');assert.equal(e.calls.length,1);
  assert.equal(e.calls[0].url,origin+'/group/index');assert.equal(e.calls[0].options.credentials,'same-origin');
  e.state.userId='43';assert.equal((await client.groups())[0].id,'43');assert.equal(e.calls.length,2);
  e.state.loggedIn=false;await assert.rejects(client.groups(),/请先登录 OJ/);
});
test('parallel reads share one request and failed reads can be retried',async()=>{
  const e=environment(),client=e.client();await Promise.all([client.request('/bootstrap'),client.request('/bootstrap')]);assert.equal(e.calls.length,1);
  e.state.fail=true;await assert.rejects(client.request('/semester'),/读取失败/);
  e.state.fail=false;await client.request('/semester');assert.equal(e.calls.length,3);
});

test('live OJ reads bypass both caches and replace the cached rank',async()=>{
  const e=environment(),client=e.client(),path='/api/contests/1326/rank';
  assert.equal((await client.oj(path)).n,1);assert.equal((await e.client().oj(path)).n,1);
  assert.equal((await client.oj(path,undefined,true)).n,2);assert.equal((await client.oj(path)).n,2);
  assert.equal((await e.client().oj(path)).n,2);assert.equal(e.calls.length,2);
  assert.equal(e.calls[1].options.credentials,'same-origin');assert.equal(e.calls[1].options.cache,'no-store');
});
