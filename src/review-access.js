// Resolve historical reviewer names; reading review data requires no credentials.
const reviewProfileNames=new Map(),reviewProfilePending=new Map();
function reviewAccount(doc){
  const allLinks=[...doc.querySelectorAll('a[href]')];
  const path=a=>{
    const href=a.getAttribute('href')||'';
    if(typeof accodingPagePath!=='function')return href;
    try{const url=new URL(href,location.href);return url.origin===location.origin?accodingPagePath(url):'';}catch{return '';}
  };
  if(!doc.querySelector('a[href="/user/logout"]')&&!allLinks.some(a=>path(a)==='/user/logout'))return null;
  const links=allLinks.filter(a=>/^\/user\/\d+\/index$/.test(path(a)));
  // A viewed student's profile link must never become the signed-in reviewer.
  const welcome=links.find(a=>/^欢迎/.test(a.textContent.trim()));
  const link=welcome||links.find(a=>a.textContent.replace(/[\s○]/g,'')==='个人信息');
  if(!link)return null;
  return {userId:path(link).split('/')[2],name:welcome?.textContent.trim().replace(/^欢迎[，,：:\s]*/,'').trim()||''};
}
async function reviewProfileName(userId){
  userId=String(userId);if(!/^[1-9]\d*$/.test(userId))return '';
  if(reviewProfileNames.has(userId))return reviewProfileNames.get(userId);
  if(reviewProfilePending.has(userId))return reviewProfilePending.get(userId);
  const pending=(async()=>{try{
    const path=`/user/${userId}/index`,response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.url||(typeof accodingPagePath==='function'?accodingPagePath(new URL(response.url)):new URL(response.url).pathname)!==path)return '';
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
// Write sessions are created lazily when saving. Reads never call these helpers.
const reviewWriteProtocol='oj-review-write-proof-v2',reviewWriteSite='https://accoding.buaa.edu.cn:4000';
const reviewWriteSessions=new Map(),reviewWritePending=new Map();
const reviewWriteKey=(userId,cid)=>`accoding-modern.review-write.v2.${userId}.${cid}`;
let reviewWriteActor='';
const reviewWriteStorage=()=>typeof GM_getValue==='function'&&typeof GM_setValue==='function';
const reviewWriteValid=(session,userId,cid)=>session?.proof_protocol===reviewWriteProtocol&&session.contest_id===cid&&session.reviewer_id==='oj-access-'+userId&&typeof session.token==='string'&&session.token.length>0&&Number.isFinite(session.expires)&&session.expires>Date.now()/1000+60;
async function reviewWritePost(path,body){
  const response=await (typeof reviewFetch==='function'?reviewFetch:fetch)('https://muzermat.online:8443/oj-review-api/v4/write-access/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Review-State-Protocol':'2'},credentials:'omit',cache:'no-store',body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const value=await response.json();if(!response.ok){const error=new Error(value.detail||'保存身份验证失败，请重试。');error.httpStatus=response.status;throw error;}return value;
}
async function reviewWriteAccount(){
  // Read the current login at save time: a long-lived review tab can outlive an account switch.
  const response=await fetch('/',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)}),account=response.ok?reviewAccount(new DOMParser().parseFromString(await response.text(),'text/html')):null;
  if(!account){reviewWriteSessions.clear();reviewWriteActor='';throw new Error('请先登录 OJ 后再保存。');}
  if(reviewWriteActor&&reviewWriteActor!==account.userId)reviewWriteSessions.clear();reviewWriteActor=account.userId;
  return account;
}
async function invalidateReviewWriteAccess(contestId,token){
  const cid=Number(contestId),userId=reviewWriteActor;if(!userId)return;
  const key=reviewWriteKey(userId,cid),known=reviewWriteSessions.get(key);if(known&&known.token!==token)return;
  reviewWriteSessions.delete(key);if(reviewWriteStorage())try{const saved=await GM_getValue(key,null);if(saved?.token===token)await GM_setValue(key,null);}catch{}
}
async function ensureReviewWriteAccess(contestId,core){
  const cid=Number(contestId);if(!Number.isInteger(cid)||cid<1)throw new Error('保存比赛无效');
  const account=await reviewWriteAccount(),userId=account.userId,key=reviewWriteKey(userId,cid);
  let saved=reviewWriteSessions.get(key);if(!reviewWriteValid(saved,userId,cid)&&reviewWriteStorage())try{saved=await GM_getValue(key,null);}catch{}
  if(reviewWriteActor!==userId)throw new Error('OJ 账号已变化，请重试保存。');
  if(reviewWriteValid(saved,userId,cid)){reviewWriteSessions.set(key,saved);return saved.token;}
  if(reviewWritePending.has(key))return reviewWritePending.get(key);
  const pending=(async()=>{
    const displayName=account.name||await reviewProfileName(userId);if(!displayName)throw new Error('未能读取当前助教姓名，请刷新 OJ 后重试。');
    const challenge=await reviewWritePost('challenge',{contest_id:cid,user_id:userId,display_name:displayName});
    if(challenge.protocol!==reviewWriteProtocol||challenge.normalization!=='newlines-lf-v1'||typeof challenge.nonce!=='string'||!challenge.nonce||!Array.isArray(challenge.submission_ids)||challenge.submission_ids.length!==3||challenge.submission_ids.some(id=>!/^\d+$/.test(String(id))))throw new Error('保存身份验证协议无效，请更新插件。');
    const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(value=>value.toString(16).padStart(2,'0')).join('');
    const answers=await Promise.all(challenge.submission_ids.map(async id=>{
      const response=await fetch('/submission/'+id,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)}),doc=new DOMParser().parseFromString(await response.text(),'text/html'),node=doc.querySelector('pre code');
      if(!response.ok||!node)throw new Error('当前 OJ 账号没有保存本场结论所需的源码读取权限。');
      return Promise.all([...new Set(core.sourceVariants(node.textContent,String(id)).map(code=>code.replace(/\r\n?/g,'\n')))].slice(0,10).map(async code=>hash(challenge.nonce+':'+await hash(reviewWriteProtocol+'\n'+code))));
    }));
    const session=await reviewWritePost('verify',{challenge_id:challenge.challenge_id,answers});
    if(!reviewWriteValid(session,userId,cid))throw new Error('保存身份验证结果无效。');
    if(reviewWriteActor!==userId)throw new Error('OJ 账号已变化，请重试保存。');
    session.expires=Math.min(session.expires,Date.now()/1000+8*3600);reviewWriteSessions.set(key,session);
    if(reviewWriteStorage())try{await GM_setValue(key,session);}catch{}
    return session.token;
  })();reviewWritePending.set(key,pending);try{return await pending;}finally{if(reviewWritePending.get(key)===pending)reviewWritePending.delete(key);}
}
