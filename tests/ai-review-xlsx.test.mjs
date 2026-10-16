import test from 'node:test';
import assert from 'node:assert/strict';
import {aiReviewRuleScore, createAiReviewExport} from '../src/ai-review-xlsx.mjs';

const context = {className: '班/级', contest: {id: 7, title: '比赛:一', problems: [{id: 9, title: '字符 & <转换>'}]}, summary: {rows: [
  {status: 'matched', userId: '1', name: '=HYPERLINK("bad")', studentId: '0012345678901234567'},
  {status: 'matched', userId: '2', name: '同名', studentId: '002'},
  {status: 'unmatched', userId: '3', name: '同名', studentId: '003'}
]}};
const review = (id, user = '1') => ({submission_id: id, creator_id: user, problem_id: 9, result: {label: ['编号步骤', '编号步骤', '输入失败防护']}});

async function entries(result) {
  const bytes = new Uint8Array(await result.blob.arrayBuffer()), view = new DataView(bytes.buffer), files = new Map();
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  let offset = view.getUint32(bytes.length - 6, true);
  for (let i = 0; i < view.getUint16(bytes.length - 12, true); i++) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    const length = view.getUint16(offset + 28, true), local = view.getUint32(offset + 42, true), size = view.getUint32(offset + 24, true);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    files.set(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length)), new TextDecoder().decode(bytes.slice(start, start + size)));
    offset += 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return files;
}

test('review XLSX matches local columns, styling and identity ordering with literal text cells', async () => {
  const rows = [review('12', '2'), review('11'), {...review('2'), scoring: {score: 80, items: [{label: '语言机制注释'}]}}];
  const result = createAiReviewExport(rows, [], context), files = await entries(result), sheet = files.get('xl/worksheets/sheet1.xml');
  assert.equal(result.filename, '班_级-比赛_一-代码复核.xlsx');
  assert.equal(result.blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  for (const title of ['姓名', '学号', '题目', '提交记录id', '规则匹配得分', '规则命中详情', '助教复核结果', '助教复核理由']) assert.ok(sheet.includes(`>${title}</t>`));
  assert.match(sheet, /r="B2"[^>]*t="inlineStr"[^>]*><is><t[^>]*>0012345678901234567/);
  assert.match(sheet, /r="D2"[^>]*><is><t[^>]*>2</);
  assert.match(sheet, /r="D3"[^>]*><is><t[^>]*>11</);
  assert.match(sheet, /r="D4"[^>]*><is><t[^>]*>12</);
  assert.match(sheet, /r="E2"[^>]*><is><t[^>]*>80</);
  assert.match(sheet, /r="E3"[^>]*><is><t[^>]*>未评分</);
  assert.match(sheet, /编号步骤；输入失败防护/);
  assert.match(sheet, /字符 &amp; &lt;转换&gt;（题目 ID：9）/);
  assert.match(sheet, /=HYPERLINK\(&quot;bad&quot;\)/);
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /autoFilter ref="A1:P4"/);
  assert.deepEqual([...sheet.matchAll(/width="(\d+)"/g)].map(match => Number(match[1])), [14, 17, 43, 19, 19, 56, 20, 56, 16, 36, 32, 18, 60, 24, 64, 60]);
  assert.match(files.get('xl/styles.xml'), /FF254766/);
  assert.match(files.get('xl/_rels/workbook.xml.rels'), /Target="worksheets\/sheet2.xml"/);
  assert.match(files.get('xl/workbook.xml'), /name="助教反馈历史"/);
  assert.deepEqual(rows.map(row => row.submission_id), ['12', '11', '2']);
});

test('feedback revisions retain whole-contest history, conclusions and original rule reasons', async () => {
  const feedback = [1, 2].map(id => ({id, submission_id: '999', status: id === 1 ? 'suspected' : 'ordinary', reason: '理由\n第二行\u0000', reviewer_name: '助教', created: 1, run_id: 'old', code_hash: 'a'.repeat(64), baseline: {result: {label: ['编号步骤'], reason: '原始依据'}}}));
  const files = await entries(createAiReviewExport([], feedback, context)), sheet = files.get('xl/worksheets/sheet2.xml');
  assert.match(sheet, /autoFilter ref="A1:J3"/);
  for (const text of ['999', '已核查为AI', '已核查为无AI', '1970-01-01T00:00:01.000Z', '编号步骤', '原始依据', '理由\n第二行\ufffd']) assert.ok(sheet.includes(text));
  assert.match(files.get('xl/worksheets/sheet1.xml'), /autoFilter ref="A1:P1"/);
});

test('frozen rule reasons supply exact scores without guessing from labels or TA prose', () => {
  const candidate = reason => ({decision_kind: 'rule_feature_candidate', result: {reason}});
  // Matches the actual cloud publication format, including quick-pass timing text.
  assert.equal(aiReviewRuleScore(candidate('current:1-31 快速过题：F 题首次 AC，阈值 ≤ 5 分钟；规则评分60分（嫌疑阈值60分）。')), 60);
  for (const score of [0, 65, 80, 100]) assert.equal(aiReviewRuleScore(candidate(`current:1-2 规则评分${score}分（嫌疑阈值60分）；其他依据。`)), score);
  assert.equal(aiReviewRuleScore({...candidate('规则评分60分（嫌疑阈值60分）。'), scoring: {score: 85}}), 85);
  for (const reason of ['规则评分160分（嫌疑阈值60分）。', '规则评分-1分（嫌疑阈值60分）。', '相邻提交间隔60秒，代码变化比例80%', '没有得分']) assert.equal(aiReviewRuleScore(candidate(reason)), '未评分');
  assert.equal(aiReviewRuleScore({decision_kind: 'human_review', result: {reason: '规则评分80分（嫌疑阈值60分）。'}}), '未评分');
  assert.equal(aiReviewRuleScore({result: {label: ['编号步骤']}, annotation: {reason: '规则评分80分（嫌疑阈值60分）。'}}), '未评分');
});

test('main sheet uses the latest same-source feedback across runs and retains literal reasons', async () => {
  const hash = 'a'.repeat(64), note = (id, status, code_hash = hash) => ({id, submission_id: '1', code_hash, status, reason: `=理由${id}\n第二行`, run_id: 'older-run'});
  const row = {...review('1'), code_hash: hash, annotation: note(2, 'suspected'), decision_kind: 'rule_feature_candidate', result: {label: ['编号步骤'], reason: 'current:1-2 规则评分70分（嫌疑阈值60分）。'}};
  const feedback = [note(4, 'ordinary'), note(1, 'suspected'), note(99, 'suspected', 'b'.repeat(64))];
  const files = await entries(createAiReviewExport([row, review('2')], feedback, context)), sheet = files.get('xl/worksheets/sheet1.xml');
  assert.match(sheet, /r="E2"[^>]*><is><t[^>]*>70</);
  assert.match(sheet, /r="G2"[^>]*><is><t[^>]*>已核查为无AI</);
  assert.match(sheet, /r="H2"[^>]*><is><t[^>]*>=理由4\n第二行</);
  assert.match(sheet, /r="G3"[^>]*><is><t[^>]*>未复核</);
  assert.doesNotMatch(sheet, /<f[ >]/);
  const newer = {...row, annotation: note(5, 'suspected')};
  const annotationSheet = (await entries(createAiReviewExport([newer], feedback, context))).get('xl/worksheets/sheet1.xml');
  assert.match(annotationSheet, /r="G2"[^>]*><is><t[^>]*>已核查为AI</);
  assert.match(annotationSheet, /r="H2"[^>]*><is><t[^>]*>=理由5\n第二行</);
});

test('unmatched and missing student identities fail instead of creating an incomplete roster', () => {
  assert.throws(() => createAiReviewExport([review('1', '3')], [], context), /姓名或学号/);
  const missing = structuredClone(context); missing.summary.rows[0].studentId = '';
  assert.throws(() => createAiReviewExport([review('1')], [], missing), /姓名或学号/);
});

test('upgraded XLSX preserves uncertain, both scores, versions and WA evidence',async()=>{
  const row={...review('1'),review_status:'reviewed_uncertain',raw_score:80,auxiliary_score:55,profile_version:'profiles-v1',rule_version:'rules-vNext',evaluation_result:'AC',annotation:{id:3,status:'uncertain',reason:'需复查'},previous_submission:{submission_id:'4',result:'WA',code_hash:'c'.repeat(64)}};
  const files=await entries(createAiReviewExport([row],[],context)),sheet=files.get('xl/worksheets/sheet1.xml'),evidence=files.get('xl/worksheets/sheet3.xml');
  for(const text of ['已核查为存疑','80','55','rules-vNext','profiles-v1'])assert.ok(sheet.includes(text));
  assert.match(evidence,/WA/);assert.match(evidence,/历史对照/);
  assert.throws(()=>createAiReviewExport([{...row,annotation:{status:'unknown'}}],[],context),/格式无效/);
});
