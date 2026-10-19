import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../src/upsolve-activation.js',import.meta.url),'utf8');
for(const ids of [['10263'],['10263','10256','10270']])test(`permission POST uses original field names and JSON arrays for ${ids.length} selected problems`,async()=>{
 const calls=[],origin='https://accoding.buaa.edu.cn:4000';
 const context=vm.createContext({URL,AbortSignal,location:{href:origin+'/',origin},accodingPath:path=>path,accodingPagePath:url=>url.pathname,
  DOMParser:class{parseFromString(){return {querySelector:()=>null};}},
  fetch:async(path,init)=>{calls.push({path,init});return {ok:true,url:origin+path,text:async()=>'<form></form>'};}});
 vm.runInContext(source,context);
 const io=vm.runInContext('createUpsolveActivationIO()',context);
 await io.savePermissions('124',ids.map(id=>({id,access:'protect'})));
 assert.equal(calls.length,1);const {path,init}=calls[0];
 assert.equal(path,'/group/124/manage/problem');assert.equal(init.method,'POST');assert.equal(init.credentials,'same-origin');
 assert.equal(init.headers['Content-Type'],'application/json');
 assert.deepEqual(JSON.parse(init.body),{problem_id:ids,access_level:ids.map(()=>'protect')});
});
