import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdateChecker} from '../src/update-core.mjs';

function setup(version='1.9.0'){
  let time=100000,remote='1.14.0',calls=0,fail=false,options,url;
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const fetchImpl=async(_url,opts)=>{calls++;options=opts;url=_url;if(fail)throw new Error('offline');return {ok:true,json:async()=>({version:remote,installUrl:'https://untrusted.invalid'})};};
  const checker=createUpdateChecker({version,storage,fetchImpl,now:()=>time});
  return {checker,storage,fetchImpl,now:()=>time,advance:n=>time+=n,setRemote:v=>remote=v,setFail:()=>fail=true,get calls(){return calls;},get options(){return options;},get url(){return url;}};
}
test('numeric version comparison, fixed update destinations, and credential-free checks',async()=>{
  const s=setup();const r=await s.checker.check();assert.equal(r.available,true);assert.match(r.installUrl,/raw\.githubusercontent\.com\/y38501148-max/);assert.equal(s.options.credentials,'omit');assert.equal(s.options.referrerPolicy,'no-referrer');
  s.setRemote('1.8.9');assert.ok((await s.checker.check(true)).error);
  const equal=setup();equal.setRemote('1.9.0');assert.equal((await equal.checker.check(true)).available,false);
});
test('automatic checks share six-hour cache across page loads; manual check bypasses it',async()=>{
  const s=setup();await s.checker.check();const next=createUpdateChecker({version:'1.9.0',storage:s.storage,fetchImpl:s.fetchImpl,now:s.now});
  assert.equal((await next.check()).cached,true);assert.equal(s.calls,1);await next.check(true);assert.equal(s.calls,2);
  s.advance(6*60*60*1000);await next.check();assert.equal(s.calls,3);
});
test('dismissal lasts one day only for the same remote version',async()=>{
  const s=setup();await s.checker.check();s.checker.dismiss('1.14.0');assert.equal((await s.checker.check()).dismissed,true);
  s.setRemote('1.14.1');assert.equal((await s.checker.check(true)).dismissed,false);
  s.checker.dismiss('1.14.1');s.advance(24*60*60*1000);assert.equal((await s.checker.check()).dismissed,false);
});
test('network and malformed manifest failures preserve last known update, never claim latest',async()=>{
  const s=setup();await s.checker.check();s.setRemote('<script>');const bad=await s.checker.check(true);assert.ok(bad.error);assert.equal(bad.latestVersion,'1.14.0');
  s.setFail();const failed=await s.checker.check(true);assert.ok(failed.error);assert.equal(failed.available,true);const n=s.calls;await s.checker.check();assert.equal(s.calls,n);
});
test('storage denied does not break checking, concurrent calls share one request',async()=>{
  let calls=0;const checker=createUpdateChecker({version:'1.14.0',storage:{getItem(){throw Error();},setItem(){throw Error();}},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({version:'1.15.0'})};}});
  const results=await Promise.all([checker.check(),checker.check()]);assert.equal(calls,1);assert.ok(results.every(r=>r.available));
});


test('manual checks and install links avoid stale release URLs',async()=>{
  const s=setup();await s.checker.check();const automatic=s.url;
  const r=await s.checker.check(true);
  assert.notEqual(s.url,automatic);assert.ok(new URL(s.url).searchParams.get('check'));
  assert.equal(s.options.cache,'no-store');assert.equal(new URL(r.installUrl).searchParams.get('version'),'1.14.0');
  assert.equal(r.checkedAt,s.now());
});
test('manual click during automatic check fetches again and sees the new release',async()=>{
  let calls=0,finishAutomatic;
  const checker=createUpdateChecker({version:'1.14.1',fetchImpl:async()=>{
    calls++;
    if(calls===1)return new Promise(resolve=>{finishAutomatic=resolve;});
    return {ok:true,json:async()=>({version:'1.15.2'})};
  }});
  const automatic=checker.check();const manual=checker.check(true);const secondClick=checker.check(true);
  assert.equal(calls,1);finishAutomatic({ok:true,json:async()=>({version:'1.14.1'})});
  const values=await Promise.all([automatic,manual,secondClick]);
  assert.equal(calls,2);assert.equal(values[0].available,false);
  assert.equal(values[1].latestVersion,'1.15.2');assert.equal(values[2].latestVersion,'1.15.2');
});
test('an older CDN manifest never replaces a previously discovered update',async()=>{
  const s=setup('1.14.0');s.setRemote('1.15.1');await s.checker.check();s.setRemote('1.14.0');
  const stale=await s.checker.check(true);assert.ok(stale.error);assert.equal(stale.latestVersion,'1.15.1');assert.equal(stale.available,true);
});
