import test from 'node:test';
import assert from 'node:assert/strict';
import {listPageUrl, createListPageLoader} from '../src/list-filter-core.mjs';
const base = 'https://accoding.buaa.edu.cn:4000/problem/index?group=124&page=4';
test('pagination stays on the same list and preserves native filters', () => {
  assert.equal(listPageUrl('./index?page=2', base), 'https://accoding.buaa.edu.cn:4000/problem/index?group=124&page=2');
  for (const href of ['https://example.com/problem/index?page=2', '/user/logout?page=2', '?page=0', '?page=-1', '?page=Infinity', '?page=9007199254740992', '#']) assert.equal(listPageUrl(href, base), null, href);
  assert.equal(listPageUrl('?offset=0', base), 'https://accoding.buaa.edu.cn:4000/problem/index?group=124&offset=0');
});
test('starting in the middle searches both directions, follows new pages and avoids cycles', async () => {
  const calls = [], records = [];
  const links = {p1: ['p2'], p2: ['p1', 'p3'], p4: ['p3', 'p5'], p5: ['p4']};
  const loader = createListPageLoader({initialUrl: 'p3', urls: ['p1', 'p2', 'p3', 'p4'],
    readPage: async url => {calls.push(url); return {urls: links[url]};}, onPage: (_, url) => records.push(url)});
  await loader.run();
  assert.deepEqual(calls, ['p1', 'p2', 'p4', 'p5']);
  assert.deepEqual(records, calls);
  assert.equal(loader.state.complete, true);
  assert.equal(loader.state.pages, 5);
});
test('bounded batches remain incomplete and can continue without rereading successful pages', async () => {
  const calls = [];
  const loader = createListPageLoader({initialUrl: 'p1', urls: ['p2'], batchSize: 2,
    readPage: async url => {calls.push(url); return {urls: url === 'p4' ? [] : ['p' + (Number(url.slice(1)) + 1)]};}, onPage() {}});
  await loader.run();
  assert.equal(loader.state.complete, false);
  assert.equal(loader.state.pages, 3);
  await loader.run();
  assert.deepEqual(calls, ['p2', 'p3', 'p4']);
  assert.equal(loader.state.complete, true);
});
test('a failed page stays queued for retry and successful pages are retained', async () => {
  let fail = true;
  const calls = [];
  const loader = createListPageLoader({initialUrl: 'p1', urls: ['p2', 'p3'],
    readPage: async url => {calls.push(url); if (url === 'p3' && fail) throw Error('HTTP 503'); return {urls: []};}, onPage() {}});
  await loader.run();
  assert.equal(loader.state.error, 'HTTP 503');
  assert.equal(loader.state.complete, false);
  fail = false;
  await loader.run();
  assert.deepEqual(calls, ['p2', 'p3', 'p3']);
  assert.equal(loader.state.error, '');
  assert.equal(loader.state.complete, true);
});
test('pause aborts in-flight reads, ignores late results, and leaves the page resumable', async () => {
  let finish, calls = 0, added = 0;
  const loader = createListPageLoader({initialUrl: 'p1', urls: ['p2'],
    readPage: async () => {calls++; if (calls === 1) return new Promise(resolve => {finish = resolve;}); return {urls: []};},
    onPage() {added++;}});
  const running = loader.run();
  await loader.run();
  assert.equal(calls, 1);
  loader.pause();
  finish({urls: []});
  await running;
  assert.equal(added, 0);
  assert.equal(loader.state.error, '');
  assert.equal(loader.state.complete, false);
  await loader.run();
  assert.equal(added, 1);
  assert.equal(loader.state.complete, true);
});
