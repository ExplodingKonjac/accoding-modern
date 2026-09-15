function mountContestBoard(Core) {
  if (!/^\/contest(?:-ng)?\//.test(location.pathname) || document.getElementById('am-contest-tools')) return;
  const host=document.createElement('div'); host.id='am-contest-tools';
  const root=host.attachShadow({mode:'open'});
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const btn=(text,fn)=>{const b=make('button','',text);b.type='button';b.addEventListener('click',fn);return b;};
  const style=make('style','');
  style.textContent=`
:host{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:#e6edf7;font-size:clamp(16px,1.05vw,22px);line-height:1.5}
*{box-sizing:border-box}button,select{font:inherit}button{cursor:pointer;color:inherit;background:#1a2942;border:1px solid #34445f;padding:8px 13px;border-radius:8px}button:hover{background:#253a59}button:disabled{opacity:.5;cursor:wait}button:focus-visible,select:focus-visible{outline:2px solid #63a7ff;outline-offset:3px}
.launch{position:fixed;right:24px;bottom:24px;z-index:1040;background:#2458d3;color:#fff;border-color:#386ce4;padding:12px 19px;box-shadow:0 8px 26px #14264930}
.overlay{position:fixed;inset:0;z-index:2147483000;background:#0a1120;overflow:auto;padding:24px 32px;display:flex;flex-direction:column;gap:16px;height:100dvh;min-height:0}.overlay[hidden],.launch[hidden],[hidden]{display:none!important}.overlay:fullscreen{width:100%;height:100%;}
.head{display:flex;align-items:center;justify-content:space-between;gap:20px}.eyebrow{color:#8193b0;text-transform:uppercase;letter-spacing:2px;font-size:14px;margin-bottom:8px}h1{font-size:clamp(24px,2vw,40px);line-height:1.4;margin:0;font-weight:650;overflow-wrap:anywhere}.title-area{flex:1;min-width:0}.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0}.sub{color:#a8b7cf;margin-top:8px;font-size:clamp(14px,.95vw,19px)}
.meta{display:flex;align-items:center;gap:18px;flex-wrap:wrap;color:#b5c3d9;font-size:inherit;padding:14px 0;border-top:1px solid #243147;border-bottom:1px solid #243147}.meta .actions{margin-left:auto}.legend{display:flex;align-items:center;gap:8px}.dot{width:15px;height:15px;border-radius:3px;background:#50d6bc}.dot.total{background:#45606a;border:1px solid #719da9}.note{color:#a8b7cf;font-size:clamp(14px,.95vw,19px)}select{background:#14213a;color:#dce7f8;border:1px solid #34445f;border-radius:6px;padding:5px 8px}
.message{color:#ffce8a;background:#30251c;border:1px solid #69512c;padding:10px 15px;border-radius:8px;font-size:18px;line-height:1.5}.message:empty{display:block;visibility:hidden;min-height:calc(1.5em + 22px)}/* Keeps one text line plus the 10px padding and 1px border reserved (about 61px at 18px font), so the in-flight 正在更新 banner cannot resize the flex column and shift the chart and 等待开赛 text on every refresh. */.summary{display:flex;gap:25px;flex-wrap:wrap;color:#a8b7cf;font-size:clamp(16px,1.05vw,22px);margin-top:14px}.summary strong{font-variant-numeric:tabular-nums;color:#eef3fc;font-size:clamp(24px,1.8vw,36px);margin-right:8px}
.chart-scroll{overflow:auto;position:relative;flex:1;min-height:220px}.chart{display:flex;position:relative;min-height:220px;height:100%;align-items:stretch;padding-top:50px}.column{position:relative;flex:1;min-width:108px;display:flex;flex-direction:column}.plot{position:relative;flex:1;min-height:70px;border-bottom:1px solid #7f8fa5;background:repeating-linear-gradient(to top,transparent 0,transparent calc(25% - 1px),#233049 calc(25% - 1px),#233049 25%)}
.bar{position:absolute;bottom:0;left:26%;width:53%;height:var(--height);background:var(--color);opacity:.21;border:1px solid var(--color);border-bottom:0;transition:height .5s ease}.bar.ac{left:12%;width:54%;opacity:1;background:linear-gradient(180deg,var(--color),color-mix(in srgb,var(--color),#000 16%));border:0;box-shadow:0 0 28px color-mix(in srgb,var(--color),transparent 90%)}
.delta{position:absolute;z-index:2;top:8px;left:0;right:0;text-align:center;color:#a2efbf;font-size:22px;font-weight:650;pointer-events:none;animation:am-rise 3s ease-out forwards}@keyframes am-rise{0%{opacity:0;transform:translateY(12px)}15%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translateY(-18px)}}\n.value{position:absolute;bottom:calc(var(--height) + 7px);left:0;right:0;text-align:center;font-size:clamp(30px,2.8vw,56px);font-weight:650;color:var(--color);font-variant-numeric:tabular-nums;text-shadow:0 1px 9px #000;line-height:1.1;transition:bottom .5s ease}.numbers{text-align:center;border-right:1px solid #253149;padding:10px 5px;background:color-mix(in srgb,var(--color),#0a1120 94%);font-variant-numeric:tabular-nums}.label{font-size:clamp(36px,2.6vw,52px);color:var(--color);font-weight:700}.accepted{color:#70e3af;font-size:clamp(28px,2.2vw,44px);font-weight:700}.attempted{color:#f4cc75;font-size:clamp(26px,1.9vw,38px);font-weight:600}.problem-title{color:#acbad1;font-size:clamp(14px,.95vw,19px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;margin:7px auto 0;padding:0 6px}.no-data{margin:auto;text-align:center;padding:70px 20px;color:#8e9eba;font-size:17px}
.status-card{display:flex;align-items:center;justify-content:space-between;gap:28px;flex-shrink:0;padding:20px 26px;border:1px solid #2c4162;border-radius:16px;background:#111f35;min-width:440px}.phase{font-size:clamp(26px,1.8vw,36px);color:#f2c96e;font-weight:700;white-space:nowrap}.phase[data-phase=running]{color:#61dbb1}.phase[data-phase=upcoming]{color:#8bb8ff}.clock{text-align:right}.timer{font-size:clamp(36px,3vw,60px);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:1px;color:#edf3fd;line-height:1.2}.clock small{display:block;color:#b6c5df;font-size:clamp(14px,.95vw,19px);white-space:nowrap;margin-bottom:6px}.privacy{font-size:clamp(13px,.9vw,18px);color:#9eafca;margin:0}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.head,.meta,.privacy,.message{flex-shrink:0}
.mode-switch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;color:#a8b7cf;font-size:clamp(16px,1.05vw,22px)}.mode-switch button{padding:6px 15px}.mode-switch button[aria-pressed=true]{background:#254d79;border-color:#76b7ff;color:#f1f7ff}.delta.unit{top:38px;left:var(--burst-left);right:auto;font-size:clamp(64px,5.2vw,100px);line-height:1;font-weight:850;text-shadow:0 3px 8px #0a1120,0 0 22px #0a1120;animation:am-unit-rise 1.8s ease-out forwards}@keyframes am-unit-rise{0%{opacity:0;transform:translate(-50%,24px) scale(.8)}15%{opacity:1;transform:translate(-50%,12px) scale(1)}65%{opacity:1}100%{opacity:0;transform:translate(-50%,-42px) scale(1.08)}}
.waiting{flex:1;min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:16px;color:#a8b7cf;background:radial-gradient(ellipse at center,#152a493d,transparent 65%)}.waiting h2{font-size:clamp(32px,3vw,60px);font-weight:650;letter-spacing:3px;color:#d9e7fc;margin:0}.waiting p{font-size:clamp(18px,1.4vw,28px);margin:0}
@media(max-width:1100px){.head{align-items:stretch;flex-wrap:wrap}.status-card{min-width:360px}.meta .actions{margin-left:0}.note{width:100%}}
@media(max-width:700px){.overlay{padding:18px 14px;gap:14px}.head{flex-direction:column}.actions{gap:6px}.actions button{padding:7px 9px}.note{margin-left:0}.meta{gap:12px}.status-card{min-width:0;width:100%;padding:14px;gap:12px}.clock small{white-space:normal}.timer{font-size:34px}.phase{font-size:24px}.summary{gap:15px}.launch{right:16px;bottom:16px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
  root.append(style);
  const currentId=()=> location.pathname.match(/^\/contest\/(\d+)(?:\/|$)/)?.[1] || (/^\/contest-ng\//.test(location.pathname) ? location.hash.match(/^#\/(\d+)(?:\/|$)/)?.[1] : null);
  const launch=btn('▥ 赛事统计看板',()=>{const id=currentId();if(id)open(id);});launch.className='launch';
  const overlay=make('section','overlay');overlay.hidden=true;overlay.tabIndex=-1;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','赛事统计看板');
  const head=make('div','head'),titleArea=make('div','title-area');
  const heading=make('h1','','赛事统计看板'),subtitle=make('div','sub');
  let effectMode='sum';
  const modeSwitch=make('div','mode-switch');modeSwitch.setAttribute('role','group');modeSwitch.setAttribute('aria-label','通过人数动画模式');modeSwitch.append(make('span','','动画模式'));
  for(const [mode,label]of [['sum','+N 模式'],['unit','+1 模式']]){
    const button=btn(label,()=>{effectMode=mode;clearEffects();syncCounts();updateNote();for(const b of modeSwitch.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    button.dataset.mode=mode;button.setAttribute('aria-pressed',String(mode===effectMode));button.title=mode==='unit'?'按榜单增量分时回放 +1 / -；两根柱子与人数同步变化':'一次显示本次新增通过人数';modeSwitch.append(button);
  }
  titleArea.append(modeSwitch,heading,subtitle);
  const actions=make('div','actions');
  const refreshButton=btn('立即刷新',()=>refresh());
  const pauseButton=btn('暂停刷新',()=>{paused=!paused;pauseButton.textContent=paused?'恢复刷新':'暂停刷新';schedule();if(!paused)refresh();updateNote();});
  const fullscreenButton=btn('全屏',async()=>{try{if(document.fullscreenElement===host || root.fullscreenElement===overlay)await document.exitFullscreen();else await overlay.requestFullscreen();}catch{message.textContent='浏览器暂不允许全屏；当前看板已铺满页面，可使用浏览器全屏功能。';}});
  const closeButton=btn('关闭 ×',()=>close());actions.append(refreshButton,pauseButton,fullscreenButton,closeButton);head.append(titleArea);
  const meta=make('div','meta');
  for(const [cls,text] of [['','前柱：通过人数'],['total','后柱：尝试人数']]){const item=make('span','legend');item.append(make('i','dot '+cls),document.createTextNode(text));meta.append(item);}
  const intervalLabel=make('label','','刷新间隔 '),interval=make('select','');interval.setAttribute('aria-label','刷新间隔');
  for(const seconds of [1,2,5,15,30,60]){const option=make('option','',seconds+' 秒');option.value=String(seconds);interval.append(option);}interval.value='5';interval.addEventListener('change',()=>{schedule();updateNote();});intervalLabel.append(interval);meta.append(intervalLabel);
  const note=make('span','note');meta.append(actions);
  const message=make('div','message');message.setAttribute('role','status');
  const summary=make('div','summary');titleArea.append(summary);
  const chartScroll=make('div','chart-scroll'),chart=make('div','chart');chart.setAttribute('role','img');chartScroll.append(chart);
  const waiting=make('div','waiting');waiting.hidden=true;waiting.append(make('h2','','等待开赛'),make('p','','开赛后显示各题通过人数与尝试人数'));
  const statusCard=make('div','status-card'),status=make('div','phase'),clockArea=make('div','clock'),caption=make('small',''),timer=make('div','timer');clockArea.append(caption,timer);statusCard.append(status,clockArea);head.append(statusCard);
  const privacy=make('p','privacy','数据以当前账号可见的排行榜为准；同一人同一题只计一次。封榜、权限及榜单更新延迟可能影响统计。');
  const footer=make('div','meta');footer.style.cssText='border:0;padding:0;justify-content:space-between;gap:8px';footer.append(privacy,note);overlay.append(head,meta,message,waiting,chartScroll,footer);root.append(launch,overlay);document.body.append(host);
  let activeId=null,contest=null,data=null,clockOffset=0,clockSynced=false,lastSuccess=null,paused=false,poll=null,tick=null,controller=null,sequence=0,previousFocus=null,oldOverflow='',columns=[],chartSignature='',loadFailed=false,rankState=null;
  const formatDate=ms=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium',hour12:false}).format(new Date(ms));
  const updateNote=()=>{note.textContent=(effectMode==='unit'?'增量分时回放 · ':'')+(paused?'已暂停':document.hidden?'后台暂停':`每 ${interval.value} 秒刷新`)+(lastSuccess?' · 更新于 '+new Date(lastSuccess).toLocaleTimeString('zh-CN',{hour12:false}):' · 尚未读取数据');};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function clearColumnEffects(c){clearTimeout(c.burstTimer);c.burstTimer=null;c.bursts=[];c.plot.querySelectorAll('.delta').forEach(e=>e.remove());}
  function clearEffects(){for(const c of columns)clearColumnEffects(c);}
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){clearEffects();syncCounts();}});
  function emit(c,text,unitLeft){
    if(c.plot.querySelectorAll('.delta').length>=12)c.plot.querySelector('.delta').remove();
    const delta=make('div','delta'+(unitLeft===undefined?'':' unit'),text);delta.setAttribute('aria-hidden','true');
    if(unitLeft!==undefined)delta.style.setProperty('--burst-left',unitLeft+'%');
    if(text==='-')delta.style.color='#f4cc75';
    delta.addEventListener('animationend',()=>delta.remove(),{once:true});c.plot.append(delta);
  }
  function playNext(c){
    if(!c.bursts.length)return;
    c.burstTimer=setTimeout(()=>{
      c.burstTimer=null;
      if(!activeId||document.hidden||reducedMotion.matches||effectMode!=='unit'||chartScroll.hidden||!c.column.isConnected){clearColumnEffects(c);return;}
      const event=c.bursts.shift();c.shownAccepted+=event.accepted;c.shownTotal+=event.total;paintCounts();
      const symbol=Core.unitSymbol(event.kind);if(symbol)emit(c,symbol,event.left);playNext(c);
    },Math.max(0,c.bursts[0].at-performance.now()));
  }
  function animateGain(c,gain){
    if(document.hidden||reducedMotion.matches||Core.phase(contest,Date.now()+clockOffset).key==='upcoming')return;
    clearColumnEffects(c);emit(c,`+${gain} 人通过`);
  }
  function queueEvents(events){
    for(const c of columns){
      const own=events.filter(e=>e.problemId===c.id);
      if(!own.length)continue;
      const base=Math.max(performance.now(),(c.bursts.at(-1)?.at||0)+1);
      const slots=Core.unitBursts(own.length,Number(interval.value)*1000);
      c.bursts.push(...own.map((e,i)=>({...e,left:slots[i].left,at:base+slots[i].delay})));
      if(!c.burstTimer)playNext(c);
    }
  }
  function syncCounts(){
    if(!data||columns.length!==data.length)return;
    columns.forEach((c,i)=>{c.shownAccepted=data[i].accepted;c.shownTotal=data[i].total;});paintCounts();
  }
  function paintCounts(){
    if(!data||columns.length!==data.length)return;
    const displayed=columns.map(c=>({accepted:c.shownAccepted,total:c.shownTotal}));
    const max=Core.scale(displayed);
    columns.forEach((c,i)=>{const p=data[i];
      c.total.style.setProperty('--height',c.shownTotal/max*88+'%');c.ac.style.setProperty('--height',c.shownAccepted/max*88+'%');c.value.style.setProperty('--height',c.shownAccepted/max*88+'%');
      c.value.textContent=c.shownAccepted;c.accepted.textContent=c.shownAccepted;c.attempted.textContent=c.shownTotal;
      c.column.title=`${p.label} · ${p.title}\n通过 ${c.shownAccepted} 人 / 尝试 ${c.shownTotal} 人`;
    });
    summary.replaceChildren();for(const [value,label]of [[data.length,'道题'],[displayed.reduce((n,p)=>n+p.accepted,0),'人题通过'],[displayed.reduce((n,p)=>n+p.total,0),'人题尝试']]){const s=make('span','');s.append(make('strong','',String(value)),document.createTextNode(label));summary.append(s);}
    chart.setAttribute('aria-label',data.map((p,i)=>`${p.label}：通过 ${displayed[i].accepted} 人，尝试 ${displayed[i].total} 人`).join('；')||'暂无题目');
  }
  function updateClock(){
    const upcoming=!!contest && Core.phase(contest,Date.now()+clockOffset).key==='upcoming';
    if(upcoming)clearEffects();
    // Hide the entire chart immediately: bar transitions must never leak into pre-start view.
    waiting.hidden=!upcoming;chartScroll.hidden=upcoming;summary.hidden=upcoming||!data;
    for(const legend of meta.querySelectorAll('.legend'))legend.hidden=upcoming;
    updateNote();if(!contest){status.textContent=loadFailed?'数据暂不可用':'正在读取赛事';caption.textContent='';timer.textContent='—';return;}
    const p=Core.phase(contest,Date.now()+clockOffset);status.textContent=p.text;status.dataset.phase=p.key;
    caption.textContent=p.caption+(clockSynced?' · 服务器时间':' · 本机时间（未校准）');timer.textContent=p.key==='finished'?'':Core.duration(p.remaining);
  }
  function render(changes){
    heading.textContent=contest.title;subtitle.textContent=`比赛 #${activeId} · ${formatDate(contest.start)} — ${formatDate(contest.end)}（北京时间）`;
    const signature=data.map(p=>p.id+':'+p.title).join('|');
    const rebuilt=signature!==chartSignature || !columns.length;
    if(rebuilt){
      clearEffects();
      chart.replaceChildren();columns=[];chartSignature=signature;
      if(!data.length)chart.append(make('div','no-data','该赛事暂无可显示的题目'));
      const colors=['#ff657b','#ffa657','#e5d65c','#a3dd65','#55d898','#43d6c3','#4dc4ef','#719df7','#a68af4','#d180e4','#ee84b5'];
      for(let i=0;i<data.length;i++){
        const p=data[i],column=make('div','column');column.style.setProperty('--color',colors[i%colors.length]);
        const plot=make('div','plot'),total=make('div','bar'),ac=make('div','bar ac'),value=make('div','value');plot.append(total,ac,value);
        const numbers=make('div','numbers'),accepted=make('div','accepted'),attempted=make('div','attempted'),title=make('div','problem-title',p.title);title.title=p.title;
        numbers.append(make('div','label',p.label),accepted,attempted,title);column.append(plot,numbers);chart.append(column);columns.push({id:p.id,total,ac,value,accepted,attempted,column,plot,lastAccepted:null,shownAccepted:p.accepted,shownTotal:p.total,bursts:[],burstTimer:null});
      }
    }
    const animate=effectMode==='unit'&&!changes.reset&&!rebuilt&&!document.hidden&&!reducedMotion.matches&&Core.phase(contest,Date.now()+clockOffset).key!=='upcoming';
    if(animate){queueEvents(changes.events);paintCounts();}
    else {
      if(effectMode==='unit')clearEffects();
      if(effectMode==='sum')data.forEach((p,i)=>{const c=columns[i];if(c.lastAccepted!==null&&p.accepted>c.lastAccepted)animateGain(c,p.accepted-c.lastAccepted);if(c.lastAccepted!==null&&p.accepted<c.lastAccepted)clearColumnEffects(c);});
      syncCounts();
    }
    columns.forEach((c,i)=>{c.lastAccepted=data[i].accepted;});updateClock();
  }

  async function read(path,signal){
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal});
    if(!response.ok)throw new Error(response.status===401||response.status===403?'无权读取，请检查原站登录及赛事权限':`服务返回 HTTP ${response.status}`);
    if(response.redirected || !response.headers.get('content-type')?.includes('json'))throw new Error('接口未返回 JSON，请检查登录状态');
    return response.json();
  }
  async function refresh(){
    if(!activeId || controller || document.hidden)return;
    const id=activeId,version=sequence;controller=new AbortController();const ownController=controller;
    const timeout=setTimeout(()=>ownController.abort(),15000);refreshButton.disabled=true;message.textContent='正在更新…';
    try{
      const [raw,rank,server]=await Promise.allSettled([read(`/api/contests/${id}`,controller.signal),read(`/api/contests/${id}/rank`,controller.signal),read('/api/contests/server_time',controller.signal)]);
      if(version!==sequence)return;
      if(raw.status==='rejected')throw raw.reason;
      const next=Core.normalizeContest(raw.value);if(next.id!==id)throw new Error('返回的赛事 ID 不匹配');
      contest=next;const remote=Core.time(server.value?.server_time);clockSynced=Number.isFinite(remote);clockOffset=clockSynced?remote-Date.now():0;
      heading.textContent=contest.title;subtitle.textContent=`比赛 #${id} · ${formatDate(contest.start)} — ${formatDate(contest.end)}（北京时间）`;updateClock();
      if(rank.status==='rejected')throw rank.reason;
      const nextRank=Core.rankSnapshot(rank.value,next.problems);
      const changes=Core.rankEvents(rankState,nextRank);rankState=nextRank;
      data=nextRank.stats;lastSuccess=Date.now();loadFailed=false;
      message.textContent=clockSynced?'':'服务器时间暂不可用，倒计时暂按本机时间计算。';
      if(effectMode==='unit'&&!nextRank.reliable)message.textContent+=' 榜单缺少完整的用户或次数信息，已直接同步统计，暂不回放。';render(changes);
    }catch(error){
      if(version!==sequence)return;
      loadFailed=true;
      message.textContent=(lastSuccess?'刷新失败，保留上次成功数据。':'未能读取统计数据。')+' '+(error.name==='AbortError'?'请求超时，请稍后重试。':error.message);
      if(!data){chart.replaceChildren(make('div','no-data','统计暂不可用 · 请检查登录或稍后刷新'));status.textContent='数据暂不可用';}
    }finally{clearTimeout(timeout);if(controller===ownController)controller=null;if(version===sequence){refreshButton.disabled=false;schedule();}}
  }
  function schedule(){clearTimeout(poll);poll=null;if(activeId&&!paused&&!document.hidden)poll=setTimeout(refresh,Number(interval.value)*1000);}
  function open(id){
    if(!/^\d+$/.test(id))return;
    if(activeId)close(false);
    previousFocus=document.activeElement;activeId=id;sequence++;paused=false;pauseButton.textContent='暂停刷新';contest=null;data=null;rankState=null;lastSuccess=null;columns=[];chartSignature='';loadFailed=false;
    oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';overlay.hidden=false;heading.textContent=`赛事 #${id}`;subtitle.textContent='';summary.replaceChildren();chart.replaceChildren(make('div','no-data','正在读取排行榜统计…'));overlay.focus();
    tick=setInterval(updateClock,1000);updateClock();refresh();
  }
  function close(restoreFocus=true){
    clearEffects();
    sequence++;activeId=null;controller?.abort();controller=null;clearTimeout(poll);clearInterval(tick);overlay.hidden=true;document.body.style.overflow=oldOverflow;
    if(document.fullscreenElement===host || root.fullscreenElement===overlay)document.exitFullscreen().catch(()=>{});
    if(restoreFocus)previousFocus?.focus();
  }
  root.addEventListener('keydown',event=>{
    if(overlay.hidden)return;
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){const focusable=[...overlay.querySelectorAll('button,select')].filter(e=>!e.disabled);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(root.activeElement===first||root.activeElement===overlay)){event.preventDefault();last.focus();}else if(!event.shiftKey&&root.activeElement===last){event.preventDefault();first.focus();}}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearEffects();syncCounts();}schedule();if(!document.hidden&&activeId&&!paused)refresh();updateNote();});
  const route=()=>{launch.hidden=!currentId();};window.addEventListener('hashchange',route);route();
  // Links are discovered from the actual page; never enumerate inaccessible contest IDs.
  const addListButtons=()=>{
    if(currentId())return;
    for(const a of document.querySelectorAll('a[href]')){
      if(a.dataset.amBoardLink || a.closest('#navbar'))continue;
      const url=new URL(a.href,location.href);if(url.origin!==location.origin)continue;
      const id=url.pathname==='/contest-ng/index.html'?url.hash.match(/^#\/(\d+)\/?$/)?.[1]:url.pathname.match(/^\/contest\/(\d+)\/index\/?$/)?.[1];
      if(!id || currentId())continue;
      a.dataset.amBoardLink='1';const b=document.createElement('button');b.type='button';b.textContent='统计看板';b.className='am-button';b.style.cssText='margin-left:10px;font-size:12px;white-space:nowrap';b.addEventListener('click',event=>{event.preventDefault();open(id);});a.after(b);
    }
  };
  addListButtons();
  const observer=new MutationObserver(()=>{addListButtons();route();});observer.observe(document.body,{childList:true,subtree:true});
}
