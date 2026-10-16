// Prove existing OJ source-read access without transferring login cookies.
const reviewAccessSessions=new Map(),reviewAccessPending=new Map();
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
const reviewAccessUnions=new Map(),reviewAccessUnionPending=new Map(),reviewAccessCoverage=new Map();
async function reviewAccessPost(path,body){
  const response=await (typeof reviewFetch==='function'?reviewFetch:fetch)('https://muzermat.online:8443/oj-review-api/v4'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Review-State-Protocol':'2'},credentials:'omit',cache:'no-store',body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const value=await response.json();if(!response.ok)throw new Error(value.detail||'OJ 权限验证失败，请刷新重试。');return value;
}
async function reviewCurrentAccount(){
  let account=reviewAccount(document);
  if(!account){const response=await fetch('/',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});if(response.ok)account=reviewAccount(new DOMParser().parseFromString(await response.text(),'text/html'));}
  if(!account)throw new Error('请先登录 OJ 后刷新重试。');return account;
}
// A proof authenticates exactly one contest. This helper never calls the union workflow.
async function ensureReviewContestProof(contestId,core,account){
  const cid=Number(contestId),{userId}=account,key=userId+':'+cid,saved=reviewAccessSessions.get(key);
  if(saved&&saved.expires>Date.now()/1000+60)return saved;
  if(reviewAccessPending.has(key))return reviewAccessPending.get(key);
  const pending=(async()=>{
    const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const displayName=account.name||await reviewProfileName(userId);if(!displayName)throw new Error('未能读取当前助教姓名，请刷新 OJ 后重试。');
    const challenge=await reviewAccessPost('/access/challenge',{contest_id:cid,user_id:userId,display_name:displayName});
    if(!Array.isArray(challenge.submission_ids)||challenge.submission_ids.length!==3||challenge.submission_ids.some(s=>!/^\d+$/.test(s)))throw new Error('权限验证数据无效。');
    const answers=await Promise.all(challenge.submission_ids.map(async sid=>{
      const response=await fetch('/submission/'+sid,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)}),node=new DOMParser().parseFromString(await response.text(),'text/html').querySelector('pre code');
      if(!response.ok||!node)throw new Error('当前 OJ 账号没有读取此比赛源码的权限。');
      return Promise.all(core.sourceVariants(node.textContent,sid).slice(0,10).map(async code=>hash(challenge.nonce+':'+await hash(code))));
    }));
    const session=await reviewAccessPost('/access/verify',{challenge_id:challenge.challenge_id,answers});
    if(session.contest_id!==cid||typeof session.token!=='string'||!Number.isFinite(session.expires))throw new Error('权限验证结果无效。');
    reviewAccessSessions.set(key,session);return session;
  })();reviewAccessPending.set(key,pending);try{return await pending;}finally{reviewAccessPending.delete(key);}
}
async function ensureReviewAccess(contestId,core){
  const cid=Number(contestId),account=await reviewCurrentAccount(),current=await ensureReviewContestProof(cid,core,account),sameCourse=core.courseContests?.(cid)||[],all=core.collectedContests?.()||sameCourse,group=[...(sameCourse.length?sameCourse:[{id:cid}]),...all.filter(item=>item.id!==cid&&!sameCourse.some(known=>known.id===item.id))];
  if(group.length<2){reviewAccessCoverage.set(cid,{attempted_ids:[cid],verified_ids:[cid],failed_ids:[]});return current.token;}
  const unionKey=account.userId+':'+group.map(item=>item.id).sort((a,b)=>a-b).join(',');
  if(reviewAccessUnionPending.has(unionKey)){const union=await reviewAccessUnionPending.get(unionKey);return union?.contest_ids.includes(cid)?union.token:current.token;}
  const pending=(async()=>{
    const others=group.filter(item=>item.id!==cid),attempts=[],proofs=[current],failed=[];for(let offset=0;offset<others.length;offset+=3)attempts.push(...await Promise.allSettled(others.slice(offset,offset+3).map(item=>ensureReviewContestProof(item.id,core,account))));
    attempts.forEach((result,index)=>{if(result.status==='fulfilled')proofs.push(result.value);else failed.push(others[index].id);});
    const verified=proofs.map(proof=>proof.contest_id).sort((a,b)=>a-b),coverage={attempted_ids:group.map(item=>item.id),verified_ids:verified,failed_ids:failed};
    for(const item of group)reviewAccessCoverage.set(item.id,coverage);
    if(proofs.length<2)return null;
    const signature=proofs.map(proof=>proof.token).sort().join('|'),saved=reviewAccessUnions.get(unionKey);
    if(saved&&saved.signature===signature&&saved.expires>Date.now()/1000+60)return saved;
    try{const session=await reviewAccessPost('/access/combine',{tokens:proofs.map(proof=>proof.token)});
      if(typeof session.token!=='string'||!Number.isFinite(session.expires)||!Array.isArray(session.contest_ids)||session.contest_ids.length!==verified.length||session.contest_ids.some(id=>!verified.includes(id)))throw new Error('跨场权限合并结果无效。');
      reviewAccessUnions.set(unionKey,{...session,signature});return session;
    }catch{for(const item of group)reviewAccessCoverage.set(item.id,{attempted_ids:group.map(item=>item.id),verified_ids:[cid],failed_ids:group.filter(item=>item.id!==cid).map(item=>item.id),combine_error:true});return null;}
  })();reviewAccessUnionPending.set(unionKey,pending);try{const union=await pending;return union?.contest_ids.includes(cid)?union.token:current.token;}finally{reviewAccessUnionPending.delete(unionKey);}
}
