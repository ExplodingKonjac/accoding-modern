import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/review-transport.js',import.meta.url),'utf8');
const api='https://muzermat.online:8443/oj-review-api/v4/reviews/search';
const vpn='https://accoding-4000.e1.buaa.edu.cn';
const context=(origin,gm,fetcher)=>vm.createContext({location:{origin},GM_xmlhttpRequest:gm,fetch:fetcher,Response,DOMException,Promise,Error});

test('VPN review uses anonymous privileged requests and preserves response status',async()=>{
  let request;
  const sandbox=context(vpn,options=>{request=options;return {abort(){}};},()=>{throw Error('CORS fetch must not run');});
  const result=vm.runInContext(source+';reviewFetch(url,options)',Object.assign(sandbox,{url:api,options:{method:'POST',headers:{Authorization:'Bearer token'},body:'{}'}}));
  assert.equal(request.url,api);
  assert.equal(request.anonymous,true);
  assert.equal(request.headers.Authorization,'Bearer token');
  assert.equal(request.data,'{}');
  request.onload({status:403,responseText:'{"detail":"denied"}'});
  const response=await result;
  assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{detail:'denied'});
});

test('direct OJ and unrelated URLs retain native fetch',async()=>{
  const calls=[],fetcher=async url=>{calls.push(url);return {ok:true};};
  for(const [origin,url] of [['https://accoding.buaa.edu.cn:4000',api],[vpn,'/submission/42'],[vpn,'https://other.example/api']]){
    const sandbox=context(origin,()=>{throw Error('unexpected privileged request');},fetcher);
    await vm.runInContext(source+';reviewFetch(url)',Object.assign(sandbox,{url}));
  }
  assert.deepEqual(calls,[api,'/submission/42','https://other.example/api']);
});

test('aborting VPN review cancels the privileged request',async()=>{
  let cancel,aborted=false;
  const sandbox=context(vpn,options=>{cancel=options;return {abort(){aborted=true;}};},()=>{});
  const controller=new AbortController();
  const result=vm.runInContext(source+';reviewFetch(url,{signal})',Object.assign(sandbox,{url:api,signal:controller.signal}));
  controller.abort();
  await assert.rejects(result,/abort/i);
  assert.equal(aborted,true);
  cancel.onload({status:200,responseText:'{}'});
});
