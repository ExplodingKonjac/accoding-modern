// Execute on the standalone local acceptance page, using only its in-memory OJ.
(async()=>{
  const checks=[],check=(name,value)=>{if(!value)throw Error(name);checks.push(name);};
  const settle=()=>new Promise(ok=>setTimeout(ok,150));
  const root=document.querySelector('#am-upsolve-activation').shadowRoot;
  const phase=document.querySelector('#phase');
  for(const value of ['upcoming','running']){
    phase.value=value;phase.dispatchEvent(new Event('change'));await settle();
    check(value+' keeps activation disabled',root.querySelector('.launch button').disabled);
  }
  check('unfinished contests never POST',document.querySelector('#writes').textContent==='0');
  phase.value='finished';phase.dispatchEvent(new Event('change'));await settle();
  root.querySelector('.launch button').click();await settle();
  check('ended contest opens the private problem and preserves the protected one',window.demoLevels.get('100')==='protect'&&window.demoLevels.get('200')==='protect'&&document.querySelector('#writes').textContent==='1');
  check('dialog reports exact success and skip counts',root.querySelector('dialog').open&&root.querySelector('.result').textContent.includes('成功 1 题，跳过 3 题'));
  root.querySelector('.close').click();root.querySelector('.launch button').click();await settle();
  check('repeated activation does not POST again',document.querySelector('#writes').textContent==='1');
  root.querySelector('.close').click();document.querySelectorAll('[role=tab]')[1].click();await settle();
  check('one pair card displays both students',document.querySelectorAll('.ar-similarity-record').length===1&&document.querySelector('.ar-similarity-record h3').textContent.includes('演示同学甲 · 提交 #100 ↔ 演示同学乙 · 提交 #200'));
  check('problem selector excludes A and B',JSON.stringify([...document.querySelector('[aria-label=查重题目]').options].map(o=>o.value))===JSON.stringify(['all','100','200']));
  check('pair statistics count two submissions once',document.querySelector('.ar-similarity-panel [role=status]').textContent.includes('1 对嫌疑代码，涉及 2 份提交'));
  check('scope and explanatory boilerplate is hidden',!document.querySelector('.ar-similarity-panel [role=status]').textContent.includes('全场已检查')&&document.querySelector('[aria-label=查重题目]').selectedOptions[0].textContent==='全部题目');
  check('inactive AI controls are actually hidden',getComputedStyle(document.querySelector('.ar-branch-content')).display==='none');
  const entry=document.querySelector('.ar-similarity-match');entry.open=true;entry.querySelector('button').click();await settle();
  check('full comparison verifies both source identities',entry.innerText.includes('当前提交 #100')&&entry.innerText.includes('对照提交 #200')&&!entry.innerText.includes('读取失败'));
  document.querySelectorAll('[role=tab]')[0].click();await settle();
  check('the AI branch restores independently',getComputedStyle(document.querySelector('.ar-branch-content')).display!=='none'&&document.querySelectorAll('[role=tab]')[0].getAttribute('aria-selected')==='true');
  document.querySelectorAll('[role=tab]')[1].click();await settle();
  check('switching back reloads similarity results',document.querySelectorAll('.ar-similarity-record').length===1);
  const reads=window.demoSimilarityReads;
  for(const problemId of ['10','20']){
    window.demoPanel.setProblemScope({problemId,title:problemId,submissionIds:[]});await window.demoPanel.setActive(true);
    check('problem '+problemId+' is gated without a similarity query',document.querySelector('.ar-similarity-panel [role=status]').textContent.includes('本题未开放查重')&&document.querySelectorAll('.ar-similarity-record').length===0&&window.demoSimilarityReads===reads);
  }
  window.demoPanel.setProblemScope(null);await window.demoPanel.setActive(true);
  check('C pair returns after leaving A/B scope',document.querySelectorAll('.ar-similarity-record').length===1);
  const openEditor=async()=>{const entry=document.querySelector('.ar-similarity-match');entry.open=true;await settle();return entry.querySelector('.ar-similarity-editor');};
  let editor=await openEditor();
  check('new pair has no preselected conclusion',editor.querySelector('select').value==='');
  editor.querySelector('button').click();await settle();
  check('a conclusion is required before saving',window.demoFeedback.length===0&&editor.querySelector('[role=status]').textContent==='请选择结论。');
  editor.querySelector('select').value='suspected';editor.querySelector('button').click();await settle();
  check('a reason is required before saving',window.demoFeedback.length===0&&editor.querySelector('[role=status]').textContent==='请填写理由。');
  editor.querySelector('textarea').value='两份代码的错误分支相同。';editor.querySelector('textarea').dispatchEvent(new Event('input'));editor.querySelector('button').click();await settle();
  check('pair decision is saved and shown on the card',window.demoFeedback.length===1&&document.querySelector('.ar-similarity-judgement').textContent==='有抄袭');
  editor=await openEditor();
  check('saved decision and history reload',editor.querySelector('select').value==='suspected'&&editor.querySelector('.ar-similarity-history').textContent.includes('演示助教'));
  editor.querySelector('textarea').value='当面核对后，两人均能独立解释代码。';editor.querySelector('select').value='ordinary';editor.querySelector('button').click();await settle();
  check('cleared pair leaves the default queue',window.demoFeedback.length===2&&document.querySelectorAll('.ar-similarity-record').length===0);
  const reviewFilter=document.querySelector('[aria-label=查重核对状态]');reviewFilter.value='all';reviewFilter.dispatchEvent(new Event('change'));await settle();editor=await openEditor();
  check('all states retain the cleared pair and both revisions',document.querySelector('.ar-similarity-judgement').textContent==='无抄袭'&&editor.querySelectorAll('.ar-similarity-history>div').length===2);
  editor.querySelector('textarea').value='尚未提交的补充说明';editor.querySelectorAll('button')[1].click();await settle();
  check('refreshing history preserves the draft',editor.querySelector('textarea').value==='尚未提交的补充说明');

  check('page fits the viewport',document.documentElement.scrollWidth<=innerWidth);
  return {passed:checks.length,checks};
})()
