function mountListFilter({page, table, wrap, toolbar, input, info, empty, dataRows}) {
  const baseUrl = location.href;
  const kind = location.pathname.split('/')[1];
  const form = table.closest('form');
  // The native submission search uses a read-only POST with these four fields.
  const body = kind === 'submission' && form ? new URLSearchParams(new FormData(form)) : null;
  const tableIndex = [...page.querySelectorAll('table.table')].filter(t => !t.closest('.modal')).indexOf(table);
  const header = [...table.rows].find(row => row.cells.length);
  const signature = row => [...row.cells].map(cell => cell.textContent.replace(/\s+/g, ' ').trim()).join('|');
  const headerSignature = signature(header);
  const keyOf = row => {
    if (kind === 'submission') return row.cells[0]?.textContent.trim();
    const link = [...row.querySelectorAll('a[href]')].find(a => {
      const url = new URL(a.getAttribute('href'), baseUrl);
      return url.pathname.startsWith('/' + kind + '/') || kind === 'contest' && url.pathname.startsWith('/contest-ng/');
    });
    return link ? new URL(link.getAttribute('href'), baseUrl).href : signature(row);
  };
  const seen = new Set(dataRows.map(keyOf));
  const entries = dataRows.map(row => ({row, local: true}));
  const pageUrls = (root, url) => [...root.querySelectorAll('a[href], [onclick]')]
    .filter(node => !node.closest('table,.modal') && !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true' && !node.closest('.disabled'))
    .map(node => node.getAttribute('href') || node.getAttribute('onclick')?.match(/^\s*change_page\(\s*["']([^"']+)["']\s*\)\s*;?\s*$/)?.[1])
    .map(href => href && listPageUrl(href, url)).filter(Boolean);
  const pageParam = kind === 'submission' ? 'offset' : 'page';
  const initial = new URL(baseUrl);
  if (!initial.searchParams.has(pageParam)) initial.searchParams.set(pageParam, pageParam === 'page' ? '1' : '0');
  const initialUrl = listPageUrl(initial.href, baseUrl);
  const urls = pageUrls(page, baseUrl);
  // Starting on a later page must also search the pages before it.
  if (urls.length) {
    const first = new URL(initialUrl);
    first.searchParams.set(pageParam, pageParam === 'page' ? '1' : '0');
    urls.unshift(first.href);
  }
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'am-button';
  control.hidden = true;
  toolbar.insertBefore(control, toolbar.lastChild);
  let timer;
  const loader = createListPageLoader({initialUrl, urls,
    async readPage(url, signal) {
      const request = new AbortController();
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, {once: true});
      const timeout = setTimeout(abort, 20000);
      try {
        const response = await fetch(url, {credentials: 'same-origin', signal: request.signal,
          ...(body ? {method: 'POST', body} : {})});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (new URL(response.url).pathname !== new URL(url).pathname) throw new Error('登录状态已失效或无权读取，请刷新页面');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const remote = [...doc.querySelectorAll('#page table.table')].filter(t => !t.closest('.modal'))[tableIndex];
        const rows = remote && [...remote.rows].filter(row => row.cells.length);
        if (!rows?.length || signature(rows[0]) !== headerSignature) throw new Error('返回的列表不完整，请刷新后重试');
        const records = rows.slice(1);
        return {rows: records, urls: records.length ? pageUrls(doc.querySelector('#page'), url) : []};
      } catch (error) {
        if (request.signal.aborted && !signal.aborted) throw new Error('请求超时，请重试');
        throw error;
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
      }
    },
    onPage(result, url) {
      for (const source of result.rows) {
        const key = keyOf(source);
        if (seen.has(key)) continue;
        seen.add(key);
        const row = document.importNode(source, true);
        // Never replay the remote page's scripts, row IDs, or inline event handlers.
        row.querySelectorAll('script,style,iframe,object,embed,form').forEach(node => node.remove());
        for (const node of [row, ...row.querySelectorAll('*')]) {
          for (const attr of [...node.attributes]) if (/^on/i.test(attr.name) || attr.name === 'id') node.removeAttribute(attr.name);
        }
        for (const link of row.querySelectorAll('a[href]')) {
          const target = new URL(link.getAttribute('href'), url);
          if (target.origin === location.origin && /^https?:$/.test(target.protocol)) link.href = target.href;
          else link.removeAttribute('href');
        }
        row.querySelectorAll('input,button,select,textarea').forEach(node => {node.disabled = true; node.removeAttribute('name');});
        // Imported submission rows are snapshots; keep their absolute submission time visible.
        row.querySelectorAll('.standard-format').forEach(node => {node.style.display = 'block';});
        row.querySelectorAll('.time-difference').forEach(node => {node.style.display = 'none';});
        const detail = row.querySelector('[data-content]');
        if (detail) detail.title = detail.getAttribute('data-content');
        row.classList.add('am-remote-row');
        entries.push({row, local: false});
        (table.tBodies[0] || table).append(row);
      }
    },
    onProgress: draw
  });
  function draw() {
    const query = input.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const {row, local} of entries) {
      // Read cells only: original inline scripts must not become searchable text.
      const text = [...row.cells].map(cell => cell.textContent).join(' ').toLocaleLowerCase();
      const matches = (!query ? local : text.includes(query));
      row.classList.toggle('am-filtered', !matches);
      if (matches) count++;
    }
    const {loading, complete, pages, error} = loader.state;
    const progress = loading ? '正在跨页加载…' : error ? `加载失败：${error} · 结果不完整` : complete ? '全部加载完成' : '尚未加载全部页面';
    info.textContent = query ? `${count} 条匹配 / 已加载 ${entries.length} 条 · ${pages} 页 · ${progress}` : `当前页 ${dataRows.length} 条 · 输入关键词可跨页筛选`;
    empty.textContent = query && !complete ? '已加载页面暂无匹配，继续加载后可能找到更多记录。' : '没有匹配的记录，请调整关键词。';
    empty.hidden = count !== 0;
    control.hidden = !query || complete;
    control.textContent = loading ? '暂停加载' : error ? '重试加载' : '继续跨页加载';
    wrap.setAttribute('aria-busy', String(loading));
  }
  async function load() {
    const pending = loader.run();
    draw();
    await pending;
    draw();
  }
  input.placeholder = '跨页筛选：名称、ID、作者…';
  input.setAttribute('aria-label', '跨页筛选记录');
  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (!input.value.trim()) loader.pause();
    else if (!loader.state.loading && !loader.state.error) timer = setTimeout(load, 350);
    draw();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {event.preventDefault(); event.stopPropagation();}
  });
  control.addEventListener('click', () => {
    clearTimeout(timer);
    if (loader.state.loading) loader.pause(); else load();
  });
  window.addEventListener('pagehide', () => {clearTimeout(timer); loader.pause();});
  draw();
}
