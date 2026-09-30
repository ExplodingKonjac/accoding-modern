import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const load=name=>readFile(new URL('../src/'+name,import.meta.url),'utf8');
const [runtime,backNavigation,upsolveReader,reviewAccess]=await Promise.all(['runtime.js','back-navigation.js','upsolve-reader.js','review-access.js'].map(load));
const prefix='/https-4000/77726476706e69737468656265737421f1f4429323396657300a9cad991b26317219996f';
const origin='https://d.buaa.edu.cn';
function context(path='/submission/42',site=origin){
  const location=new URL(site+(site===origin?prefix:'')+path),calls=[];
  const window={fetch:async(input,init)=>{calls.push({input,init});return {ok:true};},addEventListener(){}};
  const sandbox=vm.createContext({location,window,URL,Request,Response,DOMException,URLSearchParams,AbortController,Map,Date,Promise});
  vm.runInContext(runtime,sandbox);
  return {sandbox,calls,window};
}

test('direct site and all VPN entrances identify the upstream application pathname',()=>{
  for(const site of ['https://accoding.buaa.edu.cn:4000',...['e1','e2','e3'].map(e=>`https://accoding-4000.${e}.buaa.edu.cn`),origin]){
    const {sandbox}=context('/contest-ng/index.html#/1315',site);
    assert.equal(vm.runInContext('ACCODING_MODERN_IS_APP',sandbox),true);
    assert.equal(vm.runInContext('ACCODING_APP_PATHNAME',sandbox),'/contest-ng/index.html');
  }
});

test('VPN requests keep their proxy prefix and leave remote URLs intact',async()=>{
  const {window,calls}=context();
  for(const url of ['/submission/index?offset=30',prefix+'/submission/index?offset=60',prefix+'?offset=0','https://muzermat.online:8443/oj-review-api/v4/reviews/search','//cdn.example/file'])await window.fetch(url);
  assert.deepEqual(calls.map(c=>String(c.input)),[prefix+'/submission/index?offset=30',prefix+'/submission/index?offset=60',prefix+'?offset=0','https://muzermat.online:8443/oj-review-api/v4/reviews/search','//cdn.example/file']);
});

test('VPN rebases URL and Request inputs while preserving POST body, credentials and cancellation',async()=>{
  const {window,calls}=context(),controller=new AbortController();
  await window.fetch(new URL(origin+'/user/123/index'));
  await window.fetch(new Request(origin+'/submission/index?offset=30',{method:'POST',body:'problem_id=42',credentials:'same-origin',signal:controller.signal}));
  assert.equal(String(calls[0].input),origin+prefix+'/user/123/index');
  const request=calls[1].input;
  assert.equal(request.url,origin+prefix+'/submission/index?offset=30');
  assert.equal(request.method,'POST');assert.equal(request.credentials,'same-origin');
  assert.equal(await request.text(),'problem_id=42');
  controller.abort();assert.equal(request.signal.aborted,true);
});

function backLink(path){
  const {sandbox}=context(path),elements=new Map();
  const element=()=>({attrs:{},append(child){this.firstElementChild=child;},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];}});
  const content={prepend(node){elements.set(node.id,node);}};
  sandbox.document={getElementById:id=>elements.get(id),createElement:element,head:{append(){}},body:{},querySelector:()=>content};
  sandbox.MutationObserver=class{observe(){}};
  vm.runInContext(backNavigation+';mountBackNavigation()',sandbox);
  return elements.get('am-back-nav').firstElementChild.getAttribute('href');
}
test('return links stay within VPN for detail, list and Angular contest routes',()=>{
  for(const [path,target] of [['/problem/42/edit','/problem/42/index'],['/submission/42','/submission/index'],['/problem/index','/'],['/contest-ng/index.html#/1315/problem/42','/contest-ng/index.html#/1315/problem']])assert.equal(backLink(path),prefix+target);
});

test('VPN submission pagination accepts proxy links and rejects login or foreign destinations',()=>{
  const {sandbox}=context('/submission/index');
  sandbox.DOMParser=class{parseFromString(href){return {querySelector:s=>s==='.submission-table'?{}:s==='#problem_id'?{value:'42'}:null,querySelectorAll:s=>s==='[onclick]'?[{textContent:'下一页',getAttribute:()=>`change_page('${href}')`}]:[]};}};
  vm.runInContext(upsolveReader,sandbox);
  for(const href of [prefix+'/submission/index?offset=30','/submission/index?offset=30','?offset=30']){
    sandbox.html=href;
    assert.equal(vm.runInContext('createUpsolveReader(Date.parse).parsePage(html,42,0).next',sandbox),30);
  }
  for(const href of [prefix+'/user/login?offset=30','https://other.example/submission/index?offset=30']){
    sandbox.html=href;
    assert.throws(()=>vm.runInContext('createUpsolveReader(Date.parse).parsePage(html,42,0)',sandbox),/提交分页异常/);
  }
});

test('VPN reviewer identity uses the signed-in navigation and excludes foreign profile links',()=>{
  const {sandbox}=context();
  const link=(href,textContent)=>({getAttribute:()=>href,textContent});
  const links=[link(origin+prefix+'/user/logout','退出'),link('https://other.example/user/999/index','欢迎，其他用户'),link(prefix+'/user/123/index','欢迎，测试助教')];
  sandbox.doc={querySelectorAll:()=>links,querySelector:()=>null};
  const account=vm.runInContext(reviewAccess+';reviewAccount(doc)',sandbox);
  assert.equal(account?.userId,'123');assert.equal(account?.name,'测试助教');
});
