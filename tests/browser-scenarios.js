// Run after browser-mock.js and the built userscript on a disposable contest detail page.
(async()=>{
  const r=document.querySelector('#am-contest-tools').shadowRoot;
  const f=window.__amFixture,checks=[];
  const check=(name,value)=>{if(!value)throw new Error(name);checks.push(name);};
  const wait=async()=>{for(let i=0;i<100;i++){if(!r.querySelector('.actions button').disabled)return;await new Promise(ok=>setTimeout(ok,50));}throw new Error('refresh timeout');};
  const refresh=async()=>{r.querySelector('.actions button').click();await wait();};
  if(r.querySelector('.overlay').hidden){r.querySelector('.launch').click();await wait();}
  f.phase='finished';await refresh();check('finished has exact fixture counts',r.querySelector('.phase').dataset.phase==='finished'&&r.querySelector('.accepted').textContent==='1577'&&r.querySelector('.attempted').textContent==='1598');
  f.phase='running';await refresh();check('running countdown',r.querySelector('.phase').dataset.phase==='running'&&/^0[01]:\d\d:\d\d$/.test(r.querySelector('.timer').textContent));
  f.fail=true;await refresh();check('failed refresh retains last success',r.querySelector('.accepted').textContent==='1577'&&r.querySelector('.message').textContent.includes('保留上次成功数据'));
  f.fail=false;f.phase='upcoming';await refresh();check('upcoming zero values and countdown',r.querySelector('.phase').dataset.phase==='upcoming'&&[...r.querySelectorAll('.accepted')].every(n=>n.textContent==='0'));
  const actions=r.querySelectorAll('.actions button');actions[3].click();check('closing hides board and restores scrolling',r.querySelector('.overlay').hidden&&document.body.style.overflow!=='hidden');
  f.denyRank=true;r.querySelector('.launch').click();await wait();check('permission error is not zero statistics',!r.querySelector('.accepted')&&r.querySelector('.message').textContent.includes('无权读取'));await new Promise(ok=>setTimeout(ok,1100));check('countdown works even without rank permission',r.querySelector('.phase').dataset.phase==='upcoming');
  f.denyRank=false;f.phase='finished';await refresh();check('manual retry recovers',r.querySelector('.accepted').textContent==='1577'&&!r.querySelector('.message').textContent);
  actions[1].click();check('pause state',r.querySelector('.note').textContent.includes('已暂停'));
  actions[3].click();f.delay=200;r.querySelector('.launch').click();actions[3].click();await new Promise(ok=>setTimeout(ok,350));check('closing aborts in-flight render',r.querySelector('.overlay').hidden);f.delay=0;
  r.querySelector('.launch').click();await wait();
  return checks;
})()
