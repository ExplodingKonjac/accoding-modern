import {createTextXlsx} from './class-xlsx.mjs';

/** Match the local review agent's six-column suspect export. */
export function createAiReviewExport(reviews, feedback, context) {
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
    return [member.name, String(member.studentId), `${problem?.title || '题目'}（题目 ID：${review.problem_id}）`, String(review.submission_id), scoring?.score ?? '未评分', labels.join('；') || '无规则命中'];
  });
  const states = {suspected: '已核查为AI', ordinary: '已核查为无AI'};
  const history = feedback.map(note => [String(note.submission_id), states[note.status] || note.status || '', note.reason || '', note.reviewer_name || note.reviewer_id || '', note.created == null ? '' : new Date(note.created * 1000).toISOString(), String(note.id ?? ''), note.run_id || '', note.code_hash || '', (note.baseline?.result?.label || []).join('；'), note.baseline?.result?.reason || '']);
  const content = createTextXlsx([
    {name: '嫌疑名单', headers: ['姓名', '学号', '题目', '提交记录id', '规则匹配得分', '规则命中详情'], rows, widths: [14, 17, 43, 19, 19, 56]},
    {name: '助教反馈历史', headers: ['提交记录id', '复核结论', '复核理由', '助教', '反馈时间（UTC）', '修订ID', '核查运行', '源码SHA-256', '原始规则特征', '原始规则理由'], rows: history, widths: [19, 20, 56, 20, 28, 14, 40, 68, 56, 56]}
  ]);
  const cleanName = value => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '_').trim().slice(0, 60) || '未命名';
  return {filename: `${cleanName(context.className)}-${cleanName(context.contest.title || context.contest.id)}-代码复核.xlsx`, blob: new Blob([content], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};
}
