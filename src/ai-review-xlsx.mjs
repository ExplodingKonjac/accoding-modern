import {createTextXlsx} from './class-xlsx.mjs';

/** Read published scores, including the exact score saved in older rule records. */
export function aiReviewRuleScore(review) {
  const score = review.raw_score ?? review.rule_score ?? review.scoring?.raw_score ?? review.scoring?.score;
  if (Number.isInteger(score) && score >= 0 && score <= 100) return score;
  if (review.decision_kind === 'rule_feature_candidate') {
    const match = /(?:^|[\s；;])规则评分(100|[1-9]?\d)分（嫌疑阈值(?:100|[1-9]?\d)分）(?:[；;。]|$)/.exec(review.result?.reason || '');
    if (match) return Number(match[1]);
  }
  return '未评分';
}

/** Match the local review agent's suspect columns and append the latest TA verdict. */
export function createAiReviewExport(reviews, feedback, context, completeEvidence=[]) {
  const states = {suspected: '已核查为AI', ordinary: '已核查为无AI', uncertain: '已核查为存疑'};
  const statusLabel = status => {if(status == null)return '未复核';if(!Object.hasOwn(states,status))throw new Error('人工结论格式无效');return states[status];};
  const feedbackKey = row => `${row.submission_id}:${row.code_hash}`;
  const latest = new Map();
  for(const note of feedback)statusLabel(note.status);
  for (const note of feedback) {
    if (!note.code_hash) continue;
    const key = feedbackKey(note), prior = latest.get(key);
    if (!prior || Number(note.id) > Number(prior.id)) latest.set(key, note);
  }
  const members = new Map(context.summary.rows.filter(row => row.status === 'matched').map(row => [String(row.userId), row]));
  const problems = new Map(context.contest.problems.map(problem => [String(problem.id), problem]));
  const identity = review => {
    const member = members.get(String(review.creator_id));
    if (!member?.name?.trim() || !String(member.studentId ?? '').trim()) throw new Error('提交缺少可核实的姓名或学号，未导出不完整名单。');
    return member;
  };
  const ordered = [...reviews].sort((a, b) => String(identity(a).studentId).localeCompare(String(identity(b).studentId)) || Number(a.problem_id) - Number(b.problem_id) || Number(a.submission_id) - Number(b.submission_id));
  const rows = ordered.map(review => {
    const member = identity(review), problem = problems.get(String(review.problem_id)), scoring = review.scoring;
    const labels = [...new Set(scoring?.items?.map(item => item.label) || review.result?.label || review.labels || [])];
    const saved = latest.get(feedbackKey(review)), annotation = review.annotation;
    const note = saved && (!annotation || Number(saved.id) >= Number(annotation.id)) ? saved : annotation;
    return [member.name, String(member.studentId), `${problem?.title || '题目'}（题目 ID：${review.problem_id}）`, String(review.submission_id), aiReviewRuleScore(review), labels.join('；') || '无规则命中', statusLabel(note?.status), note?.reason || '', review.evaluation_result||review.judge_result||'', review.rule_version||'', review.profile_version||review.scoring?.profile_version||'', review.profile_stale||review.profile_scope_pending?'待更新':review.profile_scores_valid===false?'无可用画像':review.auxiliary_score??review.scoring?.auxiliary_score??'未评分', JSON.stringify(review.score_adjustments||review.scoring?.adjustments||[]), review.review_status||'未复核', `https://accoding.buaa.edu.cn:4000/submission/${review.submission_id}`, JSON.stringify(review.history_hits||[])];
  });
  const history = feedback.map(note => [String(note.submission_id), statusLabel(note.status), note.reason || '', note.reviewer_name || note.reviewer_id || '', note.created == null ? '' : new Date(note.created * 1000).toISOString(), String(note.id ?? ''), note.run_id || '', note.code_hash || '', (note.baseline?.result?.label || []).join('；'), note.baseline?.result?.reason || '']);
  const evidence = ordered.flatMap(review => {const refs=[...(review.evidence||[]).map(item=>({...item,role:'当前命中'})),...(review.context_references||[]),...(review.evidence_chain||[]),...(review.history_hits||[]),...(review.previous_submission?[{...review.previous_submission,role:'同题前版'}]:[])];return refs.map(item=>[String(review.submission_id),String(item.submission_id||review.submission_id),item.role||item.kind||'历史对照',item.evaluation_result||item.result||item.judge_result||'',item.result==='WA'?'历史对照':item.role||'',item.submitted_at||'',item.code_hash||review.code_hash||'',String(item.start_line??''),String(item.end_line??''),item.quote||item.explanation||JSON.stringify(item)]);});
  for(const item of completeEvidence){const source=item.source||{};for(const note of item.feedback_history||[])statusLabel(note.status);evidence.push(['',String(source.submission_id),item.role==='history_comparison'?'历史对照':'完整命中历史',source.evaluation_result||'',item.role==='history_comparison'?'历史对照':(item.rule_hit?.labels||[]).join('；'),source.submitted_at||'',source.code_hash||'','','',JSON.stringify({rule_hit:item.rule_hit,record:item.record,feedback_history:item.feedback_history})]);}
  const splitEvidence=[];for(const row of evidence){const text=String(row[9]||'');if(text.length<=30000){splitEvidence.push(row);continue;}let offset=0,part=0;while(offset<text.length){let end=Math.min(offset+30000,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;splitEvidence.push([...row.slice(0,9),`[分片 ${++part}] `+text.slice(offset,end)]);offset=end;}}
  const content = createTextXlsx([
    {name: '嫌疑名单', headers: ['姓名', '学号', '题目', '提交记录id', '规则匹配得分', '规则命中详情', '助教复核结果', '助教复核理由', '评测结果', '规则版本', '画像版本', '画像辅助分', '分值调整与引用', '核查状态', '源码链接', '历史命中'], rows, widths: [14, 17, 43, 19, 19, 56, 20, 56, 16, 36, 32, 18, 60, 24, 64, 60]},
    {name: '助教反馈历史', headers: ['提交记录id', '复核结论', '复核理由', '助教', '反馈时间（UTC）', '修订ID', '核查运行', '源码SHA-256', '原始规则特征', '原始规则理由'], rows: history, widths: [19, 20, 56, 20, 28, 14, 40, 68, 56, 56]},
    {name:'完整证据与对照',headers:['代表提交','证据提交','关系','评测结果','用途','提交时间','源码SHA-256','起始行','结束行','证据原文'],rows:splitEvidence,widths:[19,19,24,16,20,28,68,12,12,80]}
  ]);
  const cleanName = value => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '_').trim().slice(0, 60) || '未命名';
  return {filename: `${cleanName(context.className)}-${cleanName(context.contest.title || context.contest.id)}-代码复核.xlsx`, blob: new Blob([content], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};
}
