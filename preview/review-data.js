// Local preview data for the real review UI and its existing request protocol.
(() => {
  const code=`#include <stdio.h>

int main(void) {
    int n;
    long long sum = 0;
    scanf("%d", &n);

    for (int i = 0; i < n; ++i) {
        int value;
        scanf("%d", &value);
        sum += value;
    }

    printf("%lld\\n", sum);
    return 0;
}
`;
  const previous=code.replace('long long sum = 0;','int sum = 0;').replace('%lld','%d');
  const names=['林同学','周同学','陈同学','许同学','刘同学','宋同学'];
  const now=Date.now(),run='preview-20261019',hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const ready=Promise.all([hash(code),hash(previous)]);
  const notes=new Map(),pairNotes=new Map();
  const record=async index=>{
    const hashes=await ready,id=String(6100+index),saved=notes.get(id);
    return {submission_id:id,creator_id:String(1000+index),problem_id:102,contest_id:1326,run_id:run,code,code_hash:hashes[0],configuration_sha256:'a'.repeat(64),decision_kind:'rule_feature_candidate',call_id:null,rule_version:'features-v4',submitted_at:new Date(now-5400000+index*60000).toISOString(),evaluation_result:'AC',review_status:saved?({ordinary:'reviewed_no_ai',uncertain:'reviewed_uncertain',suspected:'reviewed_ai'}[saved.status]):'rule_hit_unreviewed',...(saved?{annotation:saved}:{}),raw_score:35+index*4,auxiliary_score:28+index*3,result:{ai_suspected:true,label:['短时间大幅改写'],reason:'同题前后两份提交的实现发生变化，需结合源码核对。'},evidence:[{start_line:8,end_line:11,quote:code.split('\n').slice(7,11).join('\n')}],previous_submission:{submission_id:String(5100+index),creator_id:String(1000+index),problem_id:102,contest_id:1326,run_id:run,code_hash:hashes[1],kind:'previous'}};
  };
  const source=async id=>{
    const older=Number(id)<6000,index=Number(id)-(older?5100:6100),r=await record(index);return {...r,submission_id:String(id),code:older?previous:code,code_hash:(await ready)[older?1:0],submitted_at:new Date(now-(older?5700000:5400000)+index*60000).toISOString()};
  };
  const raw=async id=>{
    const s=await source(id);return `/*\n Author: ${names[(Number(s.creator_id)-1000)%names.length]}(${s.creator_id})\n Result: AC   Submission_id: ${id}\n Created at: ${s.submitted_at}\n Problem: 102   Time: 2   Memory: 1024\n*/\n\n${s.code}`;
  };
  const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const similarity=async()=>{
    const a=await record(2),b=await record(3),quote=code.split('\n').slice(7,11).join('\n');
    return {...a,version:'same-contest-peer-tokens-v1',status:'matched',peer_count:1,matches:[{reference:{submission_id:b.submission_id,creator_id:b.creator_id,problem_id:102,contest_id:1326,code_hash:b.code_hash,submitted_at:b.submitted_at},similarity:.978,matched_tokens:87,snippets:[{current:{start_line:8,end_line:11,quote},reference:{start_line:8,end_line:11,quote}}]}]};
  };
  const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
  window.previewReviewRaw=raw;
  window.previewSubmissionText=id=>{const index=Number(id)-6100;return `/*\n Author: ${names[index%names.length]}(${1000+index})\n Result: AC   Submission_id: ${id}\n Created at: ${new Date(now-5400000+index*60000).toISOString()}\n Problem: 102   Time: 2   Memory: 1024\n*/\n\n${code}`;};
  window.previewReviewService=async(url,options)=>{
    const body=typeof options.body==='string'&&options.body.startsWith('{')?JSON.parse(options.body):{};
    if(url.origin===location.origin){
      if(url.pathname==='/submission/index'&&options.method==='POST'&&new URLSearchParams(options.body).get('nickname')){
        const nickname=new URLSearchParams(options.body).get('nickname'),index=Math.max(0,names.indexOf(nickname)),rows=[];
        for(const id of [6100+index,5100+index]){const s=await source(id);rows.push(`<tr id="tr${id}"><td id="submission_id${id}">${id}</td><td><a href="/user/${s.creator_id}/index">${nickname}</a></td><td><a href="/problem/102/index">102</a></td><td id="submission_result${id}"><label>Accepted</label></td><td>100</td><td>C</td><td class="standard-format">${s.submitted_at}</td></tr>`);}
        return new Response('<input id="problem_id" value="102"><table class="submission-table">'+rows.join('')+'</table>');
      }
      if(/^\/submission\/(?:51|61)\d\d$/.test(url.pathname))return new Response(`<pre><code>${escape(await raw(url.pathname.split('/').pop()))}</code></pre>`);
      if(url.pathname==='/')return new Response('<a href="/user/1000/index">欢迎，演示助教</a><a href="/user/logout">登出</a>');
      return null;
    }
    if(url.hostname!=='muzermat.online'||!url.pathname.startsWith('/oj-review-api/v4/'))return null;
    const path=url.pathname.slice('/oj-review-api/v4'.length),id=path.match(/\/(\d+)(?:\/runs)?$/)?.[1];
    if(path.includes('/progress')||path.endsWith('/runs'))return response({runs:[{run_id:run,contest_id:1326,configuration_sha256:'a'.repeat(64),publication_ready:true,created_at:new Date(now).toISOString()}]});
    if(path==='/reviews/search'){
      const all=await Promise.all(Array.from({length:6},(_,i)=>record(i))),filtered=all.filter(r=>(!body.problem_id||r.problem_id===body.problem_id)&&(!body.review_status||r.review_status===body.review_status)&&(!body.review_queue_only||r.review_status!=='reviewed_no_ai'));
      const counts=Object.fromEntries(['rule_unmatched','rule_hit_unreviewed','reviewed_no_ai','reviewed_uncertain','reviewed_ai'].map(state=>[state,all.filter(r=>r.review_status===state).length]));return response({run_id:run,reviews:filtered.slice(body.offset,body.offset+body.limit),total:filtered.length,counts});
    }
    if(path.includes('/sources/'))return response(await source(id));
    if(path.includes('/submissions/'))return response(await record(Number(id)-6100));
    if(path.startsWith('/profiles/'))return response({profile:{creator_id:path.split('/')[2],evidence:[]}});
    if(path==='/feedback/session')return response({review_state_protocol:2,human_statuses:['ordinary','uncertain','suspected'],write_authenticated:true});
    if(path.startsWith('/feedback/')){const latest=notes.get(path.split('/').pop())||null;return response({latest,history:latest?[latest]:[]});}
    if(path==='/feedback'){const note={...body,id:Date.now(),reviewer_name:'演示助教',reviewer_id:'preview',created:Math.floor(Date.now()/1000)};notes.set(String(body.submission_id),note);return response({saved:true,feedback:note});}
    if(path==='/code-similarity/search')return response({version:'same-contest-peer-tokens-v1',run_id:run,contest_id:1326,pair_view:true,pair_count:1,source_count:2,status_count:0,total:1,records:[await similarity()]});
    if(path.includes('/code-similarity/feedback')){const key=[body.submission_id,body.reference_id].sort().join(':');if(path.endsWith('/history')){const latest=pairNotes.get(key)||null;return response({latest,history:latest?[latest]:[]});}const feedback={...body,id:Date.now(),created:Math.floor(Date.now()/1000),reviewer_name:'演示助教'};pairNotes.set(key,feedback);return response({saved:true,feedback});}
    if(path.includes('/code-similarity/'))return response(await similarity());
    if(path.endsWith('/evidence/export'))return response({run_id:run,items:[],next_offset:null,total:0});
    if(path.endsWith('/feedback/export'))return response({feedback:[],next_after:0});
    return new Response('{"detail":"预览中没有此记录"}',{status:404,headers:{'content-type':'application/json'}});
  };
  const shared=new Map();
  window.GM_getValue=(key,fallback)=>key.startsWith('accoding-modern.review-write.v2.')?{proof_protocol:'oj-review-write-proof-v2',contest_id:1326,reviewer_id:'oj-access-1000',token:'local-preview',expires:Date.now()/1000+3600}:shared.get(key)??fallback;
  window.GM_setValue=(key,value)=>shared.set(key,value);
})();
