import test from 'node:test';
import assert from 'node:assert/strict';
import {createAiReviewCore} from '../src/ai-review-core.mjs';
const core=createAiReviewCore();
const earlier={submission_id:'880000000001',creator_id:'770000000001',contest_id:990001,problem_id:660001,created_at:'2026-10-01T10:00:00Z',code_hash:'a'.repeat(64)};
const later={...earlier,submission_id:'880000000002',problem_id:660002,created_at:'2026-10-01T10:10:00Z',code_hash:'b'.repeat(64)};
const cohort={...later,submission_id:'880000000003',problem_id:660003,created_at:'2026-10-01T10:20:00Z'};
function record(changes={}){
  return {submission_id:earlier.submission_id,rule_metadata:{cross_problem_style:{comparison_mode:'within_contest_non_overlapping_pair_v1',pair_index:2,pair_id:'fixture-pair',pair_problem_ids:[earlier.problem_id,later.problem_id],selected_problem_id:earlier.problem_id,selected_side:'earlier',comparison_references:[earlier,later],pair_references:[earlier,later],initial_target_reference:earlier,changed_evidence_groups:['helper_organization','comment_organization'],admission:'two_content_groups',cohort_role:'descriptive_only',cohort_references:[cohort],pairing_population_references:[earlier,later],...changes}}};
}
test('new contest-pair narrative fixes the selected problem while allowing a later comparison',()=>{
  const value=core.contestPairNarrative(record());
  assert.equal(value.pairIndex,2);assert.equal(value.selectedProblemId,earlier.problem_id);
  assert.match(value.chronology,/较早/);assert.match(value.chronology,/更规范/);assert.match(value.timing,/对照晚于当前提交/);
  assert.match(value.content,/辅助函数组织、说明性注释组织/);assert.match(value.content,/至少两组/);
  assert.deepEqual(value.references,[earlier,later]);assert.equal(value.technical.cohort_role,'descriptive_only');assert.deepEqual(value.technical.cohort_references,[cohort]);
  assert.ok(!value.references.some(ref=>ref.submission_id===cohort.submission_id),'descriptive cohort is not a primary code reference');
});
test('one-content admission describes layout as corroboration instead of another risk group',()=>{
  const value=core.contestPairNarrative(record({selected_side:'later',selected_problem_id:later.problem_id,changed_evidence_groups:['input_idiom'],admission:'one_content_group_with_strong_layout'}));
  assert.match(value.chronology,/较晚/);assert.match(value.content,/额外输入失败检查/);assert.match(value.content,/一组，不独立计分/);
  assert.doesNotMatch(value.timing,/对照晚于当前提交/);
});
test('actual comparison endpoints take precedence over locked anchors and descriptive history',()=>{
  const replacement={...later,submission_id:'880000000004',created_at:'2026-10-01T10:15:00Z'};
  assert.deepEqual(core.contestPairNarrative(record({comparison_references:[earlier,replacement]})).references,[earlier,replacement]);
  assert.deepEqual(core.contestPairNarrative(record({comparison_references:[]})).references,[earlier,later]);
});
test('legacy and absent modes preserve the existing renderer contract',()=>{
  assert.equal(core.contestPairNarrative({}),null);
  assert.equal(core.contestPairNarrative(record({comparison_mode:'stable-prior-nonformat-v1'})),null);
  assert.equal(core.contestPairNarrative({cross_problem_style:record().rule_metadata.cross_problem_style}),null);
});
