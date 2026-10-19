// ==UserScript==
// @name         Accoding Modern · 北航 OJ 管理界面
// @namespace    local.accoding.modern
// @version      1.0.2
// @description  本地重排导航、表格和表单，保留原站登录及所有操作逻辑。
// @include      https://accoding.buaa.edu.cn:4000/*
// @include      https://accoding-4000.e1.buaa.edu.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (!ACCODING_MODERN_IS_APP || document.getElementById('am-style')) return;
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
  const setDisabled = value => {
    interfacePreference.setDisabled(value);
    location.reload();
  };
  if (interfacePreference.disabled()) {
    mountOriginalInterfaceControl(interfacePreference);
    return;
  }
  const style = el('style', '');
  style.id = 'am-style';
  style.textContent = ACCODING_WORKSPACE_CSS;
  document.head.append(style);
  document.documentElement.classList.add('am');
  navbar.querySelector('.navbar-brand')?.setAttribute('aria-label', 'Accoding 管理站首页');
  const topbar = el('header', 'am-topbar');
  const breadcrumb = el('div', '', '工作台 / ');
  const selected = navbar.querySelector('.nav-change');
  breadcrumb.append(el('strong', '', selected?.textContent.trim() || '概览'));
  const actions = el('div', 'am-top-actions');
  actions.append(button('恢复原版', () => setDisabled(true)));
  topbar.append(breadcrumb, actions);
  page.before(topbar);

  // Enhance list pages while retaining the native current-page rows and controls.
  const isList = /^\/(problem|contest|group|submission)\/index\/?$/.test(ACCODING_APP_PATHNAME);
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
    const empty = el('div', 'am-empty');
    empty.hidden = true;
    wrap.append(empty);
    mountListFilter({page, table, wrap, toolbar, input, info, empty, dataRows});
  }

  const directColumns = [...page.children].filter(n => n.tagName === 'DIV');
  if (directColumns.length === 3 && directColumns[1].querySelector('.markdown-body')) {
    const first = directColumns[0];
    if (!first.textContent.trim() && !first.querySelector('input,button,a,img,iframe')) {
      first.classList.add('am-blank-aside');
      page.classList.add('am-problem-layout');
    }
  }
  if (ACCODING_APP_PATHNAME === '/') {
    const dashboard = el('section', 'am-home');
    for (const [path, title, description] of [
      ['/problem/index', '题目管理', '查看题面、编辑内容、管理测试数据'],
      ['/contest/index', '赛事管理', '组织上机赛事，查看比赛配置'],
      ['/submission/index', '评测记录', '查看提交结果与运行详情'],
      ['/group/index', '教学小组', '进入小组，管理课程与成员']
    ]) {
      const link = el('a', '');
      link.href = accodingPath(path);
      link.append(workspaceIcon(path.split('/')[1]), el('strong', '', title));
      dashboard.append(link);
    }
    const heading = page.querySelector('h1,h2,h3');
    if (heading) heading.after(dashboard); else page.prepend(dashboard);
  }
})();
