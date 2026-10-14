(async () => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const settle = async check => { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('UI did not settle'); };
  const host = document.createElement('div'); document.body.replaceChildren(host);
  const ctx = {generation: 0, classId: 'fixture', className: '测试班', contest: {id: 1, title: '测试比赛', problems: [{id: 9, label: 'A', title: '第一题'}]}, summary: {rows: [{userId: '11', studentId: '00012345678901234567', name: '测试同学', status: 'matched'}]}};
  const records = Array.from({length: 205}, (_, i) => ({submission_id: String(i + 1), creator_id: '11', problem_id: 9, contest_id: 1, run_id: 'fixture', review_status: 'rule_hit_unreviewed', decision_kind: 'rule_feature_candidate', code_hash: 'a'.repeat(64), submitted_at: '2026-09-22T12:00:00Z', result: {label: ['编号步骤'], reason: 'current:1-2 规则评分70分（嫌疑阈值60分）。'}}));
  const queries = [], downloads = [], feedbackOffsets = []; let fail = false, pause = null;
  const core = createAiReviewCore();
  const client = {progress: async () => ({runs: [{run_id: 'fixture', contest_id: 1}]}), search: async query => {
    if (fail) throw Error('模拟网络失败');
    queries.push(query); if (query.limit === 100 && pause) await new Promise(resolve => { pause.resolve = resolve; });
    return {total: records.length, reviews: records.slice(query.offset, query.offset + query.limit)};
  }, exportFeedback: async (_contest, after) => {
    feedbackOffsets.push(after);
    return after < 2 ? {feedback: [{id: after + 1, submission_id: '1', code_hash: 'a'.repeat(64), status: after ? 'ordinary' : 'suspected', reason: '历史理由', reviewer_name: '助教', created: 1}], next_after: after + 1} : {feedback: [], next_after: after};
  }};
  const nativeClick = HTMLAnchorElement.prototype.click, nativeCreate = URL.createObjectURL;
  const blobs = new Map();
  URL.createObjectURL = blob => { const url = nativeCreate(blob); blobs.set(url, blob); return url; };
  HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push({filename: this.download, blob: blobs.get(this.href)}); else nativeClick.call(this); };
  const panel = createAiReviewPanel(host, {...core, featureClient: () => client}, () => ctx);
  const button = () => [...host.querySelectorAll('button')].find(node => node.textContent === '导出当前结果 XLSX');
  try {
    button().click(); assert(downloads.length === 0, 'no export before loading');
    await panel.setActive(true); queries.length = 0;
    button().click(); button().click(); await settle(() => !button().disabled);
    assert(downloads.length === 1, 'duplicate clicks blocked');
    assert(queries.map(query => query.offset).join(',') === '0,100,200', 'all result pages fetched');
    assert(feedbackOffsets.join(',') === '0,1,2', 'all feedback revisions fetched');
    assert(downloads[0].filename === '测试班-测试比赛-代码复核.xlsx', 'XLSX filename');
    const sheets = await readClassXlsx(downloads[0].blob);
    assert(sheets.length === 2 && sheets[0].rows.length === 206 && sheets[1].rows.length === 3, 'all rows and both sheets');
    assert(sheets[0].rows[1][1] === '00012345678901234567', 'identifier retained');
    assert(sheets[0].rows[0].length === 8 && sheets[0].rows.slice(1).every(row => row[4] === '70'), 'saved scores and eight columns');
    assert(sheets[0].rows[1][6] === '已核查为无AI' && sheets[0].rows[1][7] === '历史理由', 'latest verdict and reason');
    assert(sheets[0].rows[2][6] === '未复核' && sheets[0].rows[2][7] === '', 'unreviewed defaults');
    pause = {}; button().click(); await settle(() => pause.resolve);
    const problem = host.querySelector('[aria-label="复核题目"]'); problem.value = '9'; pause.resolve(); pause = null;
    await settle(() => !button().disabled); assert(downloads.length === 1, 'filter change cancels obsolete download');
    pause = {}; button().click(); await settle(() => pause.resolve);
    ctx.generation++; pause.resolve(); pause = null;
    await settle(() => !button().disabled); assert(downloads.length === 1, 'context change cancels obsolete download');
    fail = true; button().click(); await settle(() => !button().disabled);
    assert(host.querySelector('[role="status"]').textContent.includes('导出失败：模拟网络失败'), 'failed request reported');
    assert(downloads.length === 1, 'failed request never downloads');
    return {passed: true, exportedRows: 205, feedbackRevisions: 2, sheets: 2, pagination: true, duplicateClick: true, filterCancellation: true, contextCancellation: true, networkFailure: true};
  } finally { panel.setActive(false); HTMLAnchorElement.prototype.click = nativeClick; URL.createObjectURL = nativeCreate; }
})()
