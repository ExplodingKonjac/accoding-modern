// Run with createAiReviewCore/createAiReviewPanel and overridable write helpers in one harness scope.
(async()=>{
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const nativeEnsure=ensureReviewWriteAccess,nativeInvalidate=invalidateReviewWriteAccess;
  let proofs=0,invalidations=0,sessions=0,writes=0,denyAll=false,latest=null;const bodies=[],tokens=[];
  ensureReviewWriteAccess=async()=>`write-${++proofs}`;
  invalidateReviewWriteAccess=async(_cid,token)=>{invalidations++;assert(token===`write-${proofs}`,'invalidate only rejected writer');};
  document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
  const core=createAiReviewCore(),record={submission_id:'101',creator_id:'11',contest_id:1327,problem_id:1,run_id:'fixture',code:'int main(){}',code_hash:'a'.repeat(64),review_status:'rule_hit_unreviewed',result:{label:['输入失败防护'],reason:'规则线索'}};
  record.code_hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(record.code)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const panel=createAiReviewPanel(host,{...core,featureClient:getToken=>({submissionRuns:async()=>({runs:[{run_id:'fixture',contest_id:1327}]}),detail:async()=>structuredClone(record),feedback:async()=>({latest,history:latest?[latest]:[]}),profile:async()=>({profile:null}),session:async(_signal,write)=>{sessions++;assert(write===true,'session authenticated only for saving');return {write_authenticated:true,review_state_protocol:2,human_statuses:['ordinary','uncertain','suspected']};},saveFeedback:async body=>{writes++;bodies.push(body);tokens.push(getToken());if(writes===1||denyAll){const error=Error('当前写入凭证已失效');error.httpStatus=403;throw error;}latest={...body,id:1,created:1,reviewer_name:'模拟助教'};}})},()=>({generation:'fixture'}),null,{submissionId:'101',feedbackOnly:true,ojText:record.code});
  const save=()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='保存结论与理由到云端');
  try{
    await panel.openDetail('101');assert(proofs===0&&sessions===0,'read and edit never authenticate');
    await save().onclick();assert(proofs===0,'invalid form does not authenticate');
    host.querySelector('select[aria-label="人工复核结论"]').value='uncertain';const note=host.querySelector('textarea');note.value='需要追溯来源';await save().onclick();
    assert(proofs===2&&invalidations===1&&writes===2&&sessions===2,'403 invalidates and retries write auth exactly once');assert(bodies[0].request_id===bodies[1].request_id,'retry preserves idempotency key');assert(tokens.join(',')==='write-1,write-2','retry uses newly verified writer');assert(note.value==='需要追溯来源','successful retry keeps editor draft');
    denyAll=true;note.value='保存失败也保留的草稿';await save().onclick();assert(proofs===4&&invalidations===2&&writes===4,'repeated rejection stops after one retry');assert(note.value==='保存失败也保留的草稿'&&host.innerText.includes('草稿已保留'),'failed retry preserves user input');
    return {passed:true,lazyWriteOnly:true,noAuthBeforeValidSave:true,expired403ReverifiedOnce:true,idempotencyPreserved:true,repeatedFailureStops:true,draftPreserved:true};
  }finally{panel.setActive(false);ensureReviewWriteAccess=nativeEnsure;invalidateReviewWriteAccess=nativeInvalidate;}
})()
