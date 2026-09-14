// ==UserScript==
// @name         Accoding Modern · 北航 OJ 管理界面
// @namespace    local.accoding.modern
// @version      1.0.2
// @description  本地重排导航、表格和表单，保留原站登录及所有操作逻辑。
// @include      https://accoding.buaa.edu.cn:4000/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (location.origin !== 'https://accoding.buaa.edu.cn:4000' || document.getElementById('am-style')) return;
  const page = document.querySelector('#page');
  const navbar = document.querySelector('#navbar');
  if (!page || !navbar) return;
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, handler) => {
    const node = el('button', 'am-button', text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  };
  let disabled = false;
  try { disabled = sessionStorage.getItem('am-disabled') === '1'; } catch (_) {}
  const setDisabled = value => {
    try { sessionStorage.setItem('am-disabled', value ? '1' : '0'); } catch (_) {}
    location.reload();
  };
  if (disabled) {
    const restore = button('启用新版界面', () => setDisabled(false));
    restore.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:12px 20px;background:#2458d3;color:white;border:0;border-radius:10px;cursor:pointer';
    document.body.append(restore);
    return;
  }
  const style = el('style', '');
  style.id = 'am-style';
  style.textContent = `
html.am { --am-bg:#f5f7fb; --am-card:#fff; --am-line:#e5eaf1; --am-ink:#202b40; --am-muted:#69778e; --am-blue:#2458d3; --am-soft:#edf3ff; }
html.am body {background:var(--am-bg)!important;color:var(--am-ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.65;}
.am #container {width:auto!important;margin:0 0 0 232px;padding:0 36px;}
.am #container>.row {margin:0;}
.am #container>.row>div:first-child:empty {display:none;}
.am #container>.row>.col-lg-10 {width:100%;float:none;padding:0;}
.am #navbar {position:fixed;inset:0 auto 0 0;width:232px;min-height:100vh;margin:0;padding:30px 16px;border:0;border-right:1px solid var(--am-line);border-radius:0;background:#fff;box-shadow:none;z-index:1030;overflow-y:auto;}
.am #navbar .container-fluid {padding:0;}
.am #navbar .navbar-header,.am #navbar .navbar-nav,.am #navbar .navbar-nav>li {float:none!important;}
.am #navbar .navbar-brand {float:none;display:block;height:auto;margin:0;padding:0 12px 32px;font-size:0;color:var(--am-ink);font-weight:750;}
.am #navbar .navbar-brand::before {content:'a/';display:inline-grid;place-items:center;background:var(--am-blue);color:white;width:36px;height:36px;margin-right:10px;border-radius:10px;font:700 18px monospace;white-space:nowrap;vertical-align:middle;}
.am #navbar .navbar-brand::after {content:'accoding';font-size:23px;letter-spacing:-1px;vertical-align:middle;}
.am #navbar .navbar-collapse {display:block!important;visibility:visible!important;height:auto!important;padding:0;border:0;box-shadow:none;}
.am #navbar .navbar-toggle {display:none;}
.am #navbar .navbar-nav {margin:0!important;}
.am #navbar .navbar-middle::before {content:'教学工作空间';display:block;padding:0 14px 14px;font-size:11px;font-weight:600;letter-spacing:2px;color:var(--am-muted);}
.am #navbar .navbar-nav>li {margin:5px 0;}
.am #navbar .navbar-nav>li>a {display:flex;gap:13px;align-items:center;margin:0;padding:12px 14px!important;border-radius:9px;background:transparent;color:#59677c!important;font-size:14px;line-height:23px;text-decoration:none;}
.am #navbar .navbar-middle>li>a::before {content:'◇';width:20px;text-align:center;font-size:19px;color:#8a97ab;}
.am #navbar #problempage::before {content:'▤';}.am #navbar #contestpage::before {content:'⚑';}.am #navbar #submissionpage::before {content:'≡';}.am #navbar #informationpage::before {content:'○';}
.am #navbar .navbar-nav>li>a:hover {background:#f5f7fb;}
.am #navbar .navbar-nav>li>a.nav-change {color:var(--am-blue)!important;background:var(--am-soft)!important;font-weight:650;}
.am #navbar .navbar-right {margin-top:40px!important;padding-top:20px;border-top:1px solid var(--am-line);}
.am #navbar .navbar-right a {font-size:12px!important;}
.am #page {margin:0;min-height:calc(100vh - 160px)!important;}
.am #page>div {min-width:0;}
.am #page>div.col-lg-12 {padding:0;}
.am-topbar {display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:82px;border-bottom:1px solid var(--am-line);margin-bottom:30px;color:var(--am-muted);font-size:12px;}
.am-topbar strong {font-weight:550;color:var(--am-ink);}
.am-top-actions {display:flex;gap:10px;align-items:center;}
.am-tag {color:#168063;font-size:11px;background:#eaf7f0;border-radius:6px;padding:4px 9px;white-space:nowrap;}
.am-button {border:1px solid var(--am-line);background:white;border-radius:8px;padding:7px 12px;color:#536178;font:inherit;cursor:pointer;}
.am-button:hover {border-color:#adc1ee;color:var(--am-blue);}
.am a {color:var(--am-blue);}
.am #page h1,.am #page h2,.am #page h3 {color:var(--am-ink);font-weight:650;letter-spacing:-.5px;line-height:1.45;}
.am #page h1 {font-size:30px;}.am #page h2 {font-size:23px;}.am #page h3 {font-size:25px;margin:0 0 22px;}
.am #page .am-list-table {border:0!important;margin:0;background:white;min-width:780px;}
.am-table-wrap {position:relative;overflow-x:auto;border:1px solid var(--am-line);border-radius:12px;background:white;margin:0 0 22px;}
.am #page .am-list-table>tbody>tr>td,.am #page .am-list-table>thead>tr>th {padding:15px 16px!important;border:0;border-bottom:1px solid #edf0f5;background:white!important;color:var(--am-ink);text-align:left;vertical-align:middle;font-size:13px;line-height:1.6;}
.am #page .am-list-table>tbody>tr:hover>td {background:#f8faff!important;}
.am #page .am-list-table>tbody>tr.am-table-heading>td,.am #page .am-list-table>thead>tr>th {background:#f9fafc!important;color:var(--am-muted);font-size:11px;font-weight:600;white-space:nowrap;padding-top:13px!important;padding-bottom:13px!important;}
.am #page .am-list-table tr:last-child>td {border-bottom:0;}
.am #page .am-list-table tr.am-filtered {display:none!important;}
.am #page .am-list-table td a {text-decoration:none;}
.am #page .am-list-table td a:hover {text-decoration:underline;}
.am #page .am-list-table td.progress {min-width:86px;border-radius:0;box-shadow:none;height:auto;}
.am #page .am-list-table td.progress .progress-bar {height:6px;min-width:4px;margin:5px 0;border-radius:6px;background-image:none;box-shadow:none;animation:none;}
.am .progress-bar-success {background:#479b84;}.am .progress-bar-warning {background:#dc9b38;}.am .progress-bar-danger {background:#d66070;}
.am #page .am-list-table td.bluetd {color:#167a55!important;font-weight:600;}.am #page .am-list-table td.redtd {color:#bd495e!important;font-weight:600;}.am #page .am-list-table td.greentd {color:#996b1d!important;font-weight:600;}
.am-toolbar {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 16px;}
.am-search {display:flex;align-items:center;gap:10px;padding:9px 13px;background:white;border:1px solid var(--am-line);border-radius:9px;color:var(--am-muted);font-size:13px;}
.am-search input {border:0!important;outline:0;background:transparent;box-shadow:none!important;width:250px;max-width:55vw;font:inherit;color:var(--am-ink);}
.am-search:focus-within {border-color:#8daff0;box-shadow:0 0 0 3px #edf3ff;}
.am-count {color:var(--am-muted);font-size:12px;}
.am-empty {padding:35px;text-align:center;color:var(--am-muted);}
.am .form-control {height:auto;min-height:38px;padding:8px 12px;border:1px solid #dce3ed;border-radius:8px;box-shadow:none;background:white;color:var(--am-ink);}
.am .form-control:focus {border-color:#8daff0;box-shadow:0 0 0 3px #edf3ff;}
.am textarea.form-control {line-height:1.7;font-family:ui-monospace,SFMono-Regular,Consolas,"PingFang SC",monospace;}
.am #page textarea.markdown-body {background:#182337!important;color:#e1e8f4!important;border:1px solid #293750!important;font-family:ui-monospace,SFMono-Regular,Consolas,"PingFang SC",monospace;font-size:14px;line-height:1.85;padding:22px!important;}
.am #page .button {display:inline-block;width:auto!important;height:auto!important;min-height:36px;max-width:100%;padding:8px 14px!important;border-radius:7px;font-size:13px!important;line-height:1.6;white-space:nowrap;background-image:none!important;box-shadow:none!important;text-shadow:none!important;}
.am .btn-info {background:#eaf2ff;border-color:#c9dbf8;color:#2458d3;}
.am .btn {background-image:none!important;box-shadow:none!important;text-shadow:none!important;border-radius:7px;padding:8px 15px;font-size:13px;transition:background .15s;}
.am .btn-primary,.am .btn-success {background:var(--am-blue);border-color:var(--am-blue);color:white;}
.am .btn-primary:hover,.am .btn-success:hover {background:#1945b0;border-color:#1945b0;}
.am .btn-danger {background:#fff0f2;border-color:#f4cbd2;color:#b73951;}
.am .btn-warning {background:#fff6e7;border-color:#f0d3a0;color:#896018;}
.am .btn-default {background:white;border-color:var(--am-line);color:#58667c;}
.am .list-group-item {padding:12px 15px;background:white!important;border-color:var(--am-line);color:#59677c!important;}
.am .list-group-item.change-color,.am .list-group-item.active {background:var(--am-soft)!important;color:var(--am-blue)!important;border-color:#d6e2ff;}
.am .markdown-body {background:white;border:1px solid var(--am-line);border-radius:12px;padding:30px!important;font-size:15px;line-height:1.9;}
.am .markdown-body h2 {margin-top:30px;border-bottom:1px solid var(--am-line);padding-bottom:10px;}
.am .markdown-body pre {background:#f6f8fb;border:1px solid var(--am-line);border-radius:8px;padding:16px;color:#35415a;}
.am .markdown-body blockquote {border-left:3px solid #b5caf4;color:#68778b;background:#f7faff;padding:12px 18px;}
.am .problem-limit {color:var(--am-muted);font-size:12px;}
.am .modal-content {border:1px solid var(--am-line);border-radius:14px;box-shadow:0 20px 80px #15244030;}
.am .modal-header,.am .modal-footer {border-color:var(--am-line);padding:20px;}.am .modal-body {padding:22px;}
.am .panel {border:1px solid var(--am-line);border-radius:10px;box-shadow:none;}.am .panel-heading {background:#f9fafc!important;background-image:none!important;border-color:var(--am-line);}
.am #container footer,.am #container .footer {color:var(--am-muted);font-size:11px;}
.am .am-home {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:26px 0 40px;}
.am-home a {display:block;background:white;border:1px solid var(--am-line);padding:25px;border-radius:12px;text-decoration:none!important;transition:border-color .15s,transform .15s;}
.am-home a:hover {border-color:#abc2f3;transform:translateY(-2px);}
.am-home strong {display:block;color:var(--am-ink);font-size:18px;margin-bottom:8px;}
.am-home span {color:var(--am-muted);font-size:13px;}
.am :focus-visible {outline:2px solid #497ce0;outline-offset:3px;}
.am-dense #page .am-list-table>tbody>tr:not(.am-table-heading)>td {padding-top:8px!important;padding-bottom:8px!important;}
@media(min-width:1000px){.am #page.am-problem-layout {display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:22px;}.am #page.am-problem-layout:before,.am #page.am-problem-layout:after {display:none;}.am #page.am-problem-layout>div {width:auto;float:none;padding:0;}.am #page.am-problem-layout>div.am-blank-aside {display:none;}}
@media(min-width:1600px){.am #container {padding-left:52px;padding-right:52px;}}
@media(max-width:1000px){.am #container {margin-left:190px;padding:0 20px;}.am #navbar {width:190px;padding:24px 10px;}.am #navbar .navbar-brand::after {font-size:20px;}.am #navbar .navbar-brand {padding-left:5px;}}
@media(max-width:700px){.am #container {margin:0;padding:0 16px;}.am #navbar {position:relative;width:100%;min-height:0;border:0;border-bottom:1px solid var(--am-line);padding:16px;margin-bottom:0;}.am #navbar .navbar-brand {padding:0 0 12px;}.am #navbar .navbar-middle {display:flex;overflow-x:auto;gap:3px;}.am #navbar .navbar-middle::before,.am #navbar .navbar-middle>li>a::before {display:none;}.am #navbar .navbar-middle>li {flex-shrink:0;margin:0;}.am #navbar .navbar-nav>li>a {padding:8px 10px!important;}.am #navbar .navbar-right {display:flex;justify-content:space-between;margin-top:10px!important;padding-top:8px;}.am-topbar {min-height:70px;margin-bottom:22px;}.am-top-actions .am-tag {display:none;}.am #page h3 {font-size:23px;}.am .am-home {grid-template-columns:1fr;}.am .markdown-body {padding:20px!important;}.am #page>div {padding-left:0;padding-right:0;}}
@media(prefers-reduced-motion:reduce){.am * {transition:none!important;animation:none!important;}}
@media print{.am #navbar,.am-topbar,.am-toolbar {display:none!important;}.am #container {margin:0;padding:0;}.am-table-wrap {overflow:visible;}.am #page .am-list-table {min-width:0;}}
`;
  document.head.append(style);
  document.documentElement.classList.add('am');
  navbar.querySelector('.navbar-brand')?.setAttribute('aria-label', 'Accoding 管理站首页');
  const topbar = el('header', 'am-topbar');
  const breadcrumb = el('div', '', '工作空间 / ');
  const selected = navbar.querySelector('.nav-change');
  breadcrumb.append(el('strong', '', selected?.textContent.trim() || '概览'));
  const actions = el('div', 'am-top-actions');
  actions.append(el('span', 'am-tag', '本地外观 · 原站服务'), button('恢复原版', () => setDisabled(true)));
  topbar.append(breadcrumb, actions);
  page.before(topbar);

  // Enhance list pages only; never replace rows, IDs, controls, forms, or handlers.
  const isList = /^\/(problem|contest|group|submission)\/index\/?$/.test(location.pathname);
  if (isList) for (const table of page.querySelectorAll('table.table')) {
    if (table.closest('.modal')) continue;
    table.classList.add('am-list-table');
    const rows = [...table.rows].filter(row => row.cells.length);
    const heading = rows[0];
    if (!heading) continue;
    heading.classList.add('am-table-heading');
    const dataRows = rows.slice(1);
    const wrap = el('div', 'am-table-wrap');
    table.before(wrap);
    wrap.append(table);
    const toolbar = el('div', 'am-toolbar');
    const label = el('label', 'am-search');
    label.append(el('span', '', '⌕'));
    const input = el('input', '');
    input.type = 'search';
    input.placeholder = '筛选当前页：名称、ID、作者…';
    input.setAttribute('aria-label', '筛选当前页记录');
    label.append(input);
    const info = el('span', 'am-count');
    info.setAttribute('aria-live', 'polite');
    const compact = button('紧凑行高', () => {
      const dense = document.documentElement.classList.toggle('am-dense');
      compact.textContent = dense ? '舒适行高' : '紧凑行高';
      compact.setAttribute('aria-pressed', String(dense));
    });
    compact.setAttribute('aria-pressed', 'false');
    toolbar.append(label, info, compact);
    wrap.before(toolbar);
    const empty = el('div', 'am-empty', '当前页没有匹配的记录，请调整关键词或切换原站分页。');
    empty.hidden = true;
    wrap.append(empty);
    const filter = () => {
      const query = input.value.trim().toLocaleLowerCase();
      let count = 0;
      for (const row of dataRows) {
        const matches = [...row.cells].map(cell => cell.textContent).join(' ').toLocaleLowerCase().includes(query);
        row.classList.toggle('am-filtered', !matches);
        if (matches) count++;
      }
      info.textContent = query ? `当前页 ${count} / ${dataRows.length} 条` : `当前页 ${dataRows.length} 条 · 可用下方分页查看更多`;
      empty.hidden = count !== 0;
    };
    input.addEventListener('input', filter);
    // Some original list tables sit inside a POST form. Local search must not submit it.
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); }
    });
    filter();
  }

  const directColumns = [...page.children].filter(n => n.tagName === 'DIV');
  if (directColumns.length === 3 && directColumns[1].querySelector('.markdown-body')) {
    const first = directColumns[0];
    if (!first.textContent.trim() && !first.querySelector('input,button,a,img,iframe')) {
      first.classList.add('am-blank-aside');
      page.classList.add('am-problem-layout');
    }
  }
  if (location.pathname === '/') {
    const dashboard = el('section', 'am-home');
    for (const [path, title, description] of [
      ['/problem/index', '题目管理', '查看题面、编辑内容、管理测试数据'],
      ['/contest/index', '赛事管理', '组织上机赛事，查看比赛配置'],
      ['/submission/index', '评测记录', '查看提交结果与运行详情'],
      ['/group/index', '教学小组', '进入小组，管理课程与成员']
    ]) {
      const link = el('a', '');
      link.href = path;
      link.append(el('strong', '', title + ' ↗'), el('span', '', description));
      dashboard.append(link);
    }
    const heading = page.querySelector('h1,h2,h3');
    if (heading) heading.after(dashboard); else page.prepend(dashboard);
  }
})();
