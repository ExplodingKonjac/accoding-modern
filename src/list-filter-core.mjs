// Canonicalize only pagination URLs for this exact list and preserve its native filters.
export function listPageUrl(href, baseUrl) {
  try {
    if (!href || href.trim().startsWith('#')) return null;
    const base = new URL(baseUrl), url = new URL(href, base);
    if (url.origin !== base.origin || url.pathname !== base.pathname) return null;
    const key = url.searchParams.has('offset') ? 'offset' : 'page';
    const value = url.searchParams.get(key);
    if (value === null || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) return null;
    if (key === 'page' && Number(value) < 1) return null;
    for (const [name, val] of base.searchParams) {
      if (name !== 'page' && name !== 'offset' && !url.searchParams.has(name)) url.searchParams.append(name, val);
    }
    url.hash = '';
    url.searchParams.set(key, String(Number(value)));
    url.searchParams.sort();
    return url.href;
  } catch (_) { return null; }
}

// Failed/aborted pages stay queued. A batch cap bounds large submission histories.
export function createListPageLoader({initialUrl, urls, readPage, onPage, onProgress = () => {}, batchSize = 50}) {
  const visited = new Set([initialUrl]), pending = new Set(urls.filter(url => url !== initialUrl));
  let controller = null;
  const state = {pages: 1, loading: false, complete: pending.size === 0, error: ''};
  async function run() {
    if (state.loading || state.complete) return;
    controller = new AbortController();
    state.loading = true;
    state.error = '';
    try {
      for (let count = 0; pending.size && count < batchSize; count++) {
        const url = pending.values().next().value;
        const result = await readPage(url, controller.signal);
        controller.signal.throwIfAborted();
        onPage(result, url);
        pending.delete(url);
        visited.add(url);
        for (const next of result.urls) if (!visited.has(next)) pending.add(next);
        state.pages++;
        onProgress();
      }
    } catch (error) {
      if (!controller.signal.aborted) state.error = error.message || '读取失败';
    } finally {
      state.loading = false;
      state.complete = pending.size === 0;
      controller = null;
    }
  }
  return {state, run, pause() {controller?.abort();}};
}
