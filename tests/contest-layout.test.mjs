import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// The overlay is a flex column and .waiting is flex:1 with centered text, so any height change of
// the in-flight 正在更新 banner re-lays out the chart and the 等待开赛 text. These checks lock the
// banner to a constant height; they parse the real stylesheet instead of trusting a copy of it.
const source=await readFile(new URL('../src/contest-board.js',import.meta.url),'utf8');
const built=await readFile(new URL('../accoding-modern.user.js',import.meta.url),'utf8');
const rules=[...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selector:m[1].trim(),body:m[2]}));
const rulesFor=cls=>rules.filter(r=>r.selector.split(',').includes(cls));
// Declaration lookup by exact property name: a regex with (?:^|;) would happily match the "size"
// inside "font-size" against "min-height" and silently read the wrong value.
const pick=(body,property)=>{
  const found=body.split(';').map(part=>[part.slice(0,part.indexOf(':')),part.slice(part.indexOf(':')+1)].map(s=>s.trim())).find(([name])=>name===property);
  return found&&found[1];
};
const message=rulesFor('.message')[0];
const empty=rulesFor('.message:empty')[0];

test('the banner is rendered, so both its states exist in the stylesheet',()=>{
  assert.ok(message, '.message rule is missing');
  assert.ok(empty, '.message:empty rule is missing');
});

test('an empty banner keeps its reserved line instead of leaving the flex column',()=>{
  assert.notEqual(pick(empty.body,'display'),'none','an empty banner must stay in flow');
  assert.equal(pick(empty.body,'visibility'),'hidden','an empty banner must not paint a ghost box');
  assert.match(source,/message\.textContent='正在更新…'/,'the in-flight banner text moved; update .message:empty with it');
});

test('the reserved height is exactly one banner line plus padding and border',()=>{
  const px=(body,property)=>Number(pick(body,property).match(/(\d+(?:\.\d+)?)px/)[1]);
  const font=px(message.body,'font-size'), lineHeight=Number(pick(message.body,'line-height'));
  const chrome=2*px(message.body,'padding')+2*px(message.body,'border'), line=font*lineHeight;
  const reserved=pick(empty.body,'min-height').match(/calc\(([\d.]+)em \+ ([\d.]+)px\)/);
  assert.ok(reserved,'the reserved height must stay a calc() of em plus px');
  const round=n=>Math.round(n*1000)/1000;
  assert.equal(round(Number(reserved[2])),round(chrome),'the px term must be exactly the padding and border');
  assert.equal(round(Number(reserved[1])),round(lineHeight),'the em term must be exactly the line height');
  const box=Number(reserved[1])*font+Number(reserved[2]);
  assert.equal(round(box),round(line+chrome),'the reserve must equal one banner line plus chrome');
  assert.ok(line>0&&line<200,`${line}px is not a plausible one-line banner height`);
  assert.ok(box>40&&box<90,`a one-line banner should reserve roughly 61px, not ${box}px`);
});

test('the banner never shrinks below its line, even when the chart overflows the viewport',()=>{
  const shrink=rulesFor('.message').find(r=>pick(r.body,'flex-shrink'));
  assert.equal(pick(shrink.body,'flex-shrink'),'0','a shrinking banner would move the text while updating');
});

test('the shipped userscript carries the rebuilt rule, not a stale build',()=>{
  assert.match(built,/\.message:empty\{display:block;visibility:hidden;min-height:calc\(1\.5em \+ 22px\)\}/,'run npm run build after editing the stylesheet');
  assert.doesNotMatch(built,/\.message:empty\{display:none\}/,'the collapsing rule is still in the build output');
});
