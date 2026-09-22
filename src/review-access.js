// Prove existing OJ source-read access without transferring login cookies.
const reviewAccessSessions=new Map(),reviewAccessPending=new Map();
async function ensureReviewAccess(contestId,core){
  const cid=Number(contestId);
  let accountDocument=document;
  const accountLink=doc=>[...doc.querySelectorAll('a[href]')].find(a=>/^\/user\/\d+\/index$/.test(a.getAttribute('href')||''));
  let link=accountLink(accountDocument);
  // The standalone source page has no account navigation; read the same-origin
  // homepage using the existing session to identify the signed-in reviewer.
  if(!link||!accountDocument.querySelector('a[href="/user/logout"]')){
    const response=await fetch('/',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(response.ok){accountDocument=new DOMParser().parseFromString(await response.text(),'text/html');link=accountLink(accountDocument);}
  }
  if(!link||!accountDocument.querySelector('a[href="/user/logout"]'))throw new Error('请先登录 OJ 后刷新重试。');
  const userId=link.getAttribute('href').split('/')[2],key=userId+':'+cid;
  const saved=reviewAccessSessions.get(key);
  if(saved&&saved.expires>Date.now()/1000+60)return saved.token;
  if(reviewAccessPending.has(key))return reviewAccessPending.get(key);
  const pending=(async()=>{
    const api='https://muzermat.online:8443/oj-review-api/v4';
    const post=async(path,body)=>{const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const value=await r.json();if(!r.ok)throw new Error(value.detail||'OJ 权限验证失败，请刷新重试。');return value;};
    const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const challenge=await post('/access/challenge',{contest_id:cid,user_id:userId,display_name:([...accountDocument.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===link.getAttribute('href')&&/^欢迎/.test(a.textContent.trim()))?.textContent.trim().replace(/^欢迎[，,：:\s]*/,'')||'OJ 用户 '+userId)});
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
