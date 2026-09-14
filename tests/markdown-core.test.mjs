import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarkdownCore} from '../src/markdown-core.mjs';
const M = createMarkdownCore();
test('plain and OJ TeX become one idempotent backend representation', () => {
  const input = String.raw`$a_i+b\_j+a_{k+1}$`;
  const expected = String.raw`$a\_i+b\_j+a\_{k+1}$`;
  assert.equal(M.toOJ(input), expected);
  assert.equal(M.toOJ(expected), expected);
  assert.equal(M.toCommon(expected), '$a_i+b_j+a_{k+1}$');
});
test('parenthesis and bracket TeX survives old Markdown via dollar delimiters', () => {
  assert.equal(M.toOJ(String.raw`内联 \(a_i+b_j\)，展示 \[a_k\]。`), String.raw`内联 $a\_i+b\_j$，展示 $$a\_k$$。`);
  assert.equal(M.toOJ('$$\n  a_i +\n    b_j\n$$'), '$$\n  a\\_i +\n    b\\_j\n$$');
});
test('code fences preserve every original indentation and data character', () => {
  const input = '样例\n```text\n  a_b  \n    $x_y$\n\tend\n\n```\n结束';
  const expected = '样例\n\n      a_b  \n        $x_y$\n    \tend\n    \n\n结束';
  assert.equal(M.toOJ(input), expected);
  assert.equal(M.toOJ(expected), expected);
  const code = expected.split('\n').slice(2,6).map(l=>l.slice(4)).join('\n');
  assert.equal(code, '  a_b  \n    $x_y$\n\tend\n');
});
test('long fences may contain shorter fences; tilde and unfinished fences work', () => {
  assert.equal(M.toOJ('````md\n```\n$x_y$\n```\n````'), '    ```\n    $x_y$\n    ```');
  assert.equal(M.toOJ('~~~c\nint a_b;\n~~~\n'), '    int a_b;\n');
  assert.equal(M.toOJ('```c\nint a_b;'), '    int a_b;');
});
test('existing code, inline code, prose identifiers, URLs and HTML code stay intact', () => {
  const text = 'file_name `a_b $c_d$` ``x ` $a_b$``\n\n    $a_i+b_j$\n\tcode_x\n\n<pre>$a_i$</pre> <a href="$a_i$">link</a> https://example.org/$a_i$';
  assert.equal(M.toOJ(text), text);
  assert.equal(M.toCommon(text), text);
});
test('unclosed formulas and escaped currency are not rewritten', () => {
  const text = String.raw`未完成 $a_i，价格 \$5，变量 a_b`;
  assert.equal(M.toOJ(text), text);
});
test('TeX row separators retain backslash count and normalization is stable', () => {
  const text = String.raw`$$a_i\\_j$$`;
  assert.equal(M.toOJ(text), String.raw`$$a\_i\\\_j$$`);
  assert.equal(M.toCommon(M.toOJ(text)), text);
});
test('CRLF documents preserve line ending style and code whitespace', () => {
  assert.equal(M.toOJ('```\r\n  a_b\r\n```\r\n'), '      a_b\r\n');
});
