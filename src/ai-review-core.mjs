export function createAiReviewCore() {
  const api='https://muzermat.online:8443/oj-review-api/v2';
  const apiV4='https://muzermat.online:8443/oj-review-api/v4';
  const apiV3='https://muzermat.online:8443/oj-review-api/v3';
  const featureLabels=['输入失败防护','讲解性注释','编号步骤','对答式注释','模板化说明','注释密集','生成回答残留','短时间大幅改写','短时间码风突变','注释表达特征','模型来源注释','代码结构大幅变化','跨题码风变化','罕见共同代码片段','罕见高级用法'];
  const selections={candidate:'候选复核',sample:'连续提交抽样',manual:'单独复核'};
  const states={paused:'已暂停',running:'正在复核',completed:'复核完成',completed_with_errors:'已结束，部分失败',failed:'运行失败'};
  const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  function hasFeatureReview(r){const d=r?.result;if(r?.decision_kind==='human_review')return hash(r.configuration_sha256)&&hash(r.code_hash)&&typeof r.run_id==='string'&&!!r.run_id&&typeof d?.ai_suspected==='boolean'&&typeof d.reason==='string'&&Array.isArray(d.label)&&d.label.length===0&&Number.isInteger(r.annotation?.id);return ((r?.decision_kind==='rule_feature_candidate'&&typeof r.rule_version==='string'&&!!r.rule_version&&r.call_id===null)||(r?.decision_kind==='llm_feature_presence'&&(hash(r.model_digest)||(r.backend_kind==='remote_api'&&r.model_digest===null&&hash(r.execution_config_sha256)&&typeof r.requested_model==='string'))))&&hash(r.configuration_sha256)&&hash(r.code_hash)&&typeof r.run_id==='string'&&!!r.run_id&&d?.ai_suspected===true&&Object.keys(d).sort().join(',')==='ai_suspected,label,reason'&&typeof d.reason==='string'&&!!d.reason.trim()&&Array.isArray(d.label)&&d.label.length>0&&new Set(d.label).size===d.label.length&&d.label.every(x=>featureLabels.includes(x));}
  async function verifySource(code,expected){if(typeof code!=='string'||!hash(expected))throw new Error('源码或校验摘要缺失');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));const actual=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==expected)throw new Error('源码哈希与核查时不一致，请打开 OJ 原提交人工核验。');return code;}
  function sourceVariants(text,id){
    const header=text.match(/^\/\*[\s\S]*?\*\//),candidates=[text];
    if(header&&/Author:/.test(header[0])&&/Created at:/.test(header[0])&&/Submission_id:/.test(header[0])){
      if(header[0].match(/Submission_id:\s*(\d+)/)?.[1]!==String(id))throw new Error('OJ 返回的提交编号与上下文不一致');
      const body=text.slice(header[0].length);candidates.push(body,body.replace(/^\r?\n\r?\n/,''),body.trim());
    }
    return [...new Set(candidates.flatMap(code=>[code,...(code.startsWith('\n')?[code.slice(1)]:[]),...(code.startsWith('\r\n')?[code.slice(2)]:[])]))];
  }
  async function sourceFromOj(text,id,expected){
    for(const code of sourceVariants(text,id)){try{return await verifySource(code,expected);}catch{}}
    throw new Error('源码哈希与核查时不一致，请打开 OJ 原提交人工核验。');
  }
  function hasFlaggedReview(r){return r?.ai_suspected===true&&typeof r.model_digest==='string'&&/^[a-f0-9]{64}$/.test(r.model_digest)&&Number.isFinite(r.score)&&Number.isFinite(r.threshold)&&r.score>=r.threshold;}
  function members(rows){return new Map(rows.filter(m=>m.status==='matched'&&/^[1-9]\d*$/.test(String(m.userId))).map(m=>[String(m.userId),m]));}
  function client(getToken,fetcher=fetch){
    async function request(path,body,signal){
      const token=getToken().trim();if(!token)throw new Error('请先在复核设置中填写只读令牌。');
      const res=await fetcher(api+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},credentials:'omit',cache:'no-store',signal,body:body?JSON.stringify(body):undefined});
      if(res.status===404&&path.startsWith('/submissions/'))return null;
      if(!res.ok)throw new Error(`复核读取失败（HTTP ${res.status}）。${[401,403].includes(res.status)?'请检查只读令牌。':''}`);
      return res.json();
    }
    return {
      progress:(contest,signal)=>request(`/contests/${contest}/progress`,null,signal),
      async detail(id,signal){const r=await request(`/submissions/${encodeURIComponent(id)}/review`,null,signal);if(r&&!hasFlaggedReview(r))throw new Error('复核结果缺少有效模型判断');return r;},
      async search(query,signal){
        const r=await request('/reviews/search',query,signal);
        if(!Array.isArray(r.reviews)||!Number.isInteger(r.total)||r.total<0||r.reviews.length>query.limit)throw new Error('复核 API 返回格式无效');
        if(r.reviews.some(x=>!hasFlaggedReview(x)||x.contest_id!==query.contest_id||!query.creator_ids.includes(String(x.creator_id))))throw new Error('复核结果与当前班级不一致');
        return r;
      }
    };
  }
  function featureClient(getToken,fetcher=fetch,version=3){
    async function request(path,body,signal,absent=false){
      const token=getToken().trim();if(version!==4&&!token)throw new Error('请先在复核设置中填写只读令牌。');
      const res=await fetcher((version===4?apiV4:apiV3)+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},credentials:'omit',cache:'no-store',signal,body:body?JSON.stringify(body):undefined});
      if(res.status===404&&absent)return null;
      if(!res.ok){let body={};try{body=await res.json();}catch{}throw new Error(body.detail||`复核请求失败（HTTP ${res.status}）`);}
      return res.json();
    }
    async function runs(path,signal,contest){const r=await request(path,null,signal);if(!Array.isArray(r.runs)||r.runs.some(x=>typeof x.run_id!=='string'||!hash(x.configuration_sha256)||(contest!==undefined&&x.contest_id!==Number(contest))))throw new Error('运行清单格式或比赛不一致');return r;}
    return {
      session:signal=>request('/feedback/session',null,signal),
      source:(id,runId,signal)=>request(`/runs/${encodeURIComponent(runId)}/sources/${encodeURIComponent(id)}`,null,signal),
      feedback:(id,codeHash,runId,signal)=>request(`/feedback/${encodeURIComponent(id)}?code_hash=${encodeURIComponent(codeHash)}&run_id=${encodeURIComponent(runId)}`,null,signal),
      saveFeedback:(body,signal)=>request('/feedback',body,signal),
      exportFeedback:(contest,after=0,signal)=>request(`/contests/${encodeURIComponent(contest)}/feedback/export?after=${after}`,null,signal),
      progress:(contest,signal)=>runs(`/contests/${encodeURIComponent(contest)}/progress`,signal,contest),
      submissionRuns:(id,signal)=>runs(`/submissions/${encodeURIComponent(id)}/runs${version===4?'?include_candidates=true':''}`,signal),
      async detail(id,runId,signal){if(!runId)throw new Error('请先选择核查运行');const r=await request(`/runs/${encodeURIComponent(runId)}/submissions/${encodeURIComponent(id)}${version===4?'?include_candidates=true':''}`,null,signal,true);if(r&&(!hasFeatureReview(r)||r.run_id!==runId||String(r.submission_id)!==String(id)))throw new Error('复核详情与所选运行或提交不一致');if(r)await verifySource(r.code,r.code_hash);return r;},
      async search(query,signal){
        if(!query.run_id)throw new Error('请先选择核查运行');const r=await request('/reviews/search',version===4?{...query,include_candidates:true}:query,signal);
        if(r.run_id!==query.run_id||!Array.isArray(r.reviews)||!Number.isInteger(r.total)||r.total<0||r.reviews.length>query.limit)throw new Error('复核 API 返回格式或运行无效');
        if(r.reviews.some(x=>!hasFeatureReview(x)||x.run_id!==query.run_id||x.contest_id!==query.contest_id||!query.creator_ids.includes(String(x.creator_id))))throw new Error('复核结果与当前运行或班级不一致');
        return r;
      }
    };
  }
  function lineDiff(before,after){
    const a=before.replace(/\r\n/g,'\n').split('\n'),b=after.replace(/\r\n/g,'\n').split('\n');
    const output=[];
    function row(x,y){let p=new Uint32Array(y.length+1);for(const v of x){const q=new Uint32Array(y.length+1);for(let j=0;j<y.length;j++)q[j+1]=v===y[j]?p[j]+1:Math.max(p[j+1],q[j]);p=q;}return p;}
    function solve(x,y,oldStart,newStart){
      let front=0;while(front<x.length&&front<y.length&&x[front]===y[front]){output.push({kind:'equal',text:x[front],oldLine:oldStart+front,newLine:newStart+front});front++;}
      x=x.slice(front);y=y.slice(front);oldStart+=front;newStart+=front;
      let tail=0;while(tail<x.length&&tail<y.length&&x[x.length-1-tail]===y[y.length-1-tail])tail++;
      const xx=tail?x.slice(0,-tail):x,yy=tail?y.slice(0,-tail):y;
      if(!xx.length)yy.forEach((text,i)=>output.push({kind:'add',text,oldLine:null,newLine:newStart+i}));
      else if(!yy.length)xx.forEach((text,i)=>output.push({kind:'remove',text,oldLine:oldStart+i,newLine:null}));
      else if(xx.length===1){const at=yy.indexOf(xx[0]);if(at<0){output.push({kind:'remove',text:xx[0],oldLine:oldStart,newLine:null});yy.forEach((text,i)=>output.push({kind:'add',text,oldLine:null,newLine:newStart+i}));}else{solve([],yy.slice(0,at),oldStart,newStart);output.push({kind:'equal',text:xx[0],oldLine:oldStart,newLine:newStart+at});solve([],yy.slice(at+1),oldStart+1,newStart+at+1);}}
      else{const mid=Math.floor(xx.length/2),left=row(xx.slice(0,mid),yy),right=row(xx.slice(mid).reverse(),[...yy].reverse());let split=0;for(let j=1;j<=yy.length;j++)if(left[j]+right[yy.length-j]>left[split]+right[yy.length-split])split=j;solve(xx.slice(0,mid),yy.slice(0,split),oldStart,newStart);solve(xx.slice(mid),yy.slice(split),oldStart+mid,newStart+split);}
      for(let i=0;i<tail;i++)output.push({kind:'equal',text:x[xx.length+i],oldLine:oldStart+xx.length+i,newLine:newStart+yy.length+i});
    }
    solve(a,b,1,1);return output;
  }
  return {lineDiff,api,apiV3,apiV4,selections,states,featureLabels,members,hasFlaggedReview,hasFeatureReview,verifySource,sourceVariants,sourceFromOj,client,featureClient};
}
