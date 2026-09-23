// Prove existing OJ source-read access without transferring login cookies.
const reviewAccessSessions=new Map(),reviewAccessPending=new Map();
const reviewProfileNames=new Map(),reviewProfilePending=new Map();
function reviewAccount(doc){
  if(!doc.querySelector('a[href="/user/logout"]'))return null;
  const links=[...doc.querySelectorAll('a[href]')].filter(a=>/^\/user\/\d+\/index$/.test(a.getAttribute('href')||''));
  // A viewed student's profile link must never become the signed-in reviewer.
  const welcome=links.find(a=>/^欢迎/.test(a.textContent.trim()));
  const link=welcome||links.find(a=>a.textContent.replace(/[\s○]/g,'')==='个人信息');
  if(!link)return null;
  return {userId:link.getAttribute('href').split('/')[2],name:welcome?.textContent.trim().replace(/^欢迎[，,：:\s]*/,'').trim()||''};
}
async function reviewProfileName(userId){
  userId=String(userId);if(!/^[1-9]\d*$/.test(userId))return '';
  if(reviewProfileNames.has(userId))return reviewProfileNames.get(userId);
  if(reviewProfilePending.has(userId))return reviewProfilePending.get(userId);
  const pending=(async()=>{try{
    const path=`/user/${userId}/index`,response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.url||new URL(response.url).pathname!==path)return '';
    const doc=new DOMParser().parseFromString(await response.text(),'text/html');
    const headings=[...doc.querySelectorAll('h3')];if(headings.length!==1)return '';
    // OJ profile headings contain an optional rating title followed by the name.
    const name=headings[0].textContent.trim().replace(/^(?:Legendary Grandmaster|International Grandmaster|Grandmaster|International Master|Candidate Master|Master|Expert|Specialist|Pupil|Newbie|Unrated)\s+/i,'').trim();
    if(!name||name.length>80||/^(?:登录|用户登录|个人信息|OJ 用户\s*\d+)$/i.test(name))return '';
    reviewProfileNames.set(userId,name);return name;
  }catch{return '';}})();
  reviewProfilePending.set(userId,pending);try{return await pending;}finally{reviewProfilePending.delete(userId);}
}
async function reviewHistoryName(record){
  const stored=(record.reviewer_name||'').trim(),id=record.reviewer_id?.match(/^oj-access-([1-9]\d*)$/)?.[1];
  if(!id||stored&&!/^OJ\s*用户\s*\d+$/.test(stored)&&stored!=='个人信息')return stored;
  return await reviewProfileName(id)||stored||`OJ 用户 ${id}`;
}
async function ensureReviewAccess(contestId,core){
  const cid=Number(contestId);
  let account=reviewAccount(document);
  // Standalone source pages do not include the signed-in account navigation.
  if(!account){
    const response=await fetch('/',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(response.ok)account=reviewAccount(new DOMParser().parseFromString(await response.text(),'text/html'));
  }
  if(!account)throw new Error('请先登录 OJ 后刷新重试。');
  const {userId}=account,key=userId+':'+cid;
  const saved=reviewAccessSessions.get(key);
  if(saved&&saved.expires>Date.now()/1000+60)return saved.token;
  if(reviewAccessPending.has(key))return reviewAccessPending.get(key);
  const pending=(async()=>{
    const api='https://muzermat.online:8443/oj-review-api/v4';
    const post=async(path,body)=>{const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const value=await r.json();if(!r.ok)throw new Error(value.detail||'OJ 权限验证失败，请刷新重试。');return value;};
    const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const displayName=account.name||await reviewProfileName(userId);
    if(!displayName)throw new Error('未能读取当前助教姓名，请刷新 OJ 后重试。');
    const challenge=await post('/access/challenge',{contest_id:cid,user_id:userId,display_name:displayName});
    if(!Array.isArray(challenge.submission_ids)||challenge.submission_ids.length!==3||challenge.submission_ids.some(s=>!/^\d+$/.test(s)))throw new Error('权限验证数据无效。');
    const answers=await Promise.all(challenge.submission_ids.map(async sid=>{
      const r=await fetch('/submission/'+sid,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      const node=new DOMParser().parseFromString(await r.text(),'text/html').querySelector('pre code');
      if(!r.ok||!node)throw new Error('当前 OJ 账号没有读取此比赛源码的权限。');
      return Promise.all(core.sourceVariants(node.textContent,sid).slice(0,10).map(async code=>hash(challenge.nonce+':'+await hash(code))));
    }));
    const session=await post('/access/verify',{challenge_id:challenge.challenge_id,answers});
    if(session.contest_id!==cid||typeof session.token!=='string'||!Number.isFinite(session.expires))throw new Error('权限验证结果无效。');
    reviewAccessSessions.set(key,session);return session.token;
  })();
  reviewAccessPending.set(key,pending);
  try{return await pending;}finally{reviewAccessPending.delete(key);}
}
