// The contest Angular app replaces its ng-view on hash navigation and has no #page/#navbar.
// Scope styles to its stable template selectors so late ng-include and route changes work.
(() => {
  if (!/^\/contest-ng\//.test(location.pathname) || document.getElementById('am-ng-style')) return;
  let disabled=false;
  try { disabled=sessionStorage.getItem('am-disabled')==='1'; } catch (_) {}
  const toggle=value=>{try{sessionStorage.setItem('am-disabled',value?'1':'0');}catch(_){}location.reload();};
  const control=document.createElement('button');control.type='button';
  if(disabled){
    control.textContent='启用新版界面';
    control.style.cssText='position:fixed;bottom:24px;left:24px;z-index:1040;padding:10px 16px;border:0;border-radius:8px;background:#2458d3;color:#fff;cursor:pointer';
    control.addEventListener('click',()=>toggle(false));document.body.append(control);return;
  }
  const style=document.createElement('style');style.id='am-ng-style';
  style.textContent=`
html.am-ng{--ng-bg:#f5f7fb;--ng-card:#fff;--ng-line:#e3e9f2;--ng-ink:#202b40;--ng-muted:#6b7a90;--ng-blue:#2458d3;--ng-soft:#edf3ff;background:var(--ng-bg)}
.am-ng body{background:var(--ng-bg)!important;background-image:none!important;color:var(--ng-ink);font:14px/1.7 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.am-ng body>.container-fluid{padding:0 28px 80px;max-width:1920px;margin:auto}
.am-ng body>.container-fluid>.row,.am-ng body>.container-fluid>.row>div{margin:0;padding:0;width:100%;float:none}
.am-ng [ng-view]{display:grid;grid-template-columns:238px minmax(0,1fr);gap:26px;margin:0!important;align-items:start}
.am-ng [ng-view]:before,.am-ng [ng-view]:after{display:none}
.am-ng [ng-view]>nav{grid-column:1/-1;position:sticky;top:0;z-index:1030;min-height:76px;margin:0 -28px;padding:12px 28px;border:0;border-bottom:1px solid var(--ng-line);border-radius:0;background:#fff;box-shadow:none}
.am-ng [ng-view]>nav .navbar-brand{font-size:0;display:flex;align-items:center;gap:9px;margin-right:16px}
.am-ng [ng-view]>nav .navbar-brand:before{content:'a/';display:inline-grid;place-items:center;width:32px;height:32px;background:var(--ng-blue);border-radius:9px;color:white;font:700 17px monospace}
.am-ng [ng-view]>nav .navbar-brand:after{content:'accoding';font-size:23px;font-weight:750;letter-spacing:-1px;color:var(--ng-ink)}
.am-ng .navbar-default .navbar-nav>li>a{padding:14px 12px;font-size:13px;color:#65738a;text-shadow:none;border-radius:7px;background:transparent;box-shadow:none}
.am-ng .navbar-default .navbar-nav>li>a:hover{background:#f6f8fc;color:var(--ng-blue)}
.am-ng .navbar-default .navbar-nav>.active>a{background:var(--ng-soft)!important;color:var(--ng-blue)!important;font-weight:650}
.am-ng .navbar-right{font-size:12px}.am-ng .am-ng-reset{font:inherit;font-size:12px;margin:9px 6px;padding:5px 9px;border:1px solid var(--ng-line);border-radius:7px;background:#fff;color:var(--ng-muted);cursor:pointer}
.am-ng [ng-view]>.col-lg-2{position:sticky;top:101px;width:auto;float:none;padding:0;min-width:0;max-height:calc(100vh - 125px);overflow:auto}
.am-ng [ng-view]>.col-lg-2>h4{font-size:18px;line-height:1.65;font-weight:650;margin:0 4px 20px;overflow-wrap:anywhere}
.am-ng [ng-view]>.col-lg-2>.form-horizontal{padding:9px;background:#fff;border:1px solid var(--ng-line);border-radius:12px}
.am-ng [ng-view]>.col-lg-2>.form-horizontal>.list-group-item{border:0!important;border-radius:7px;margin:3px 0;padding:11px 14px;background:transparent;color:#5f6e84;font-size:14px}
.am-ng [ng-view]>.col-lg-2>.form-horizontal>.list-group-item.active{background:var(--ng-soft)!important;color:var(--ng-blue)!important;font-weight:650;text-shadow:none}
.am-ng [ng-include="'detail/time.html'"]{margin-top:18px;border:1px solid var(--ng-line);border-radius:12px;overflow:hidden;background:#fff}
.am-ng [ng-include="'detail/time.html'"]>label{float:none!important;display:block;width:100%;margin:0!important;padding:13px 10px!important;background:#fff!important;border:0!important;border-bottom:1px solid #edf0f6!important;font-size:11px;font-weight:400;color:var(--ng-muted)}
.am-ng [ng-include="'detail/time.html'"]>label:last-child{border-bottom:0!important;background:#f8faff!important}
.am-ng [ng-include="'detail/time.html'"] label label{font-size:13px;font-weight:550;color:#344660;font-variant-numeric:tabular-nums;margin-bottom:0}
.am-ng [ng-include="'detail/time.html'"]>label:last-child>label:last-of-type{font-size:19px;letter-spacing:1px;color:var(--ng-blue)}
.am-ng [ng-view]>.col-lg-10{width:auto;float:none;min-width:0;padding:28px 30px;background:#fff;border:1px solid var(--ng-line);border-radius:13px;min-height:calc(100vh - 140px);overflow-wrap:anywhere}
.am-ng [ng-view]>.col-lg-10>div:first-child:has(>h4){display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:25px}
.am-ng h1,.am-ng h2,.am-ng h3,.am-ng h4{color:var(--ng-ink);font-weight:650;line-height:1.5;letter-spacing:-.4px}
.am-ng h1{font-size:28px}.am-ng h2{font-size:23px}.am-ng h3{font-size:23px;margin-top:0}.am-ng h4{font-size:22px;margin:0}
.am-ng h3 small{display:inline-block;font-size:11px;letter-spacing:0;color:var(--ng-muted);font-weight:400}
.am-ng a{color:var(--ng-blue)}.am-ng a[ng-click]{cursor:pointer}
.am-ng .markdown-body{font-size:15px;line-height:1.95;color:#334057;overflow-wrap:anywhere}
.am-ng .markdown-body h2{border-bottom:1px solid var(--ng-line);padding-bottom:10px;margin:28px 0 16px}
.am-ng .markdown-body li>p{margin:7px 0}.am-ng .markdown-body strong{color:#273d61}
.am-ng .markdown-body pre{padding:16px;border:1px solid var(--ng-line);border-radius:8px;background:#f6f8fc;color:#34465f;white-space:pre;overflow:auto}
.am-ng code{color:#36598d;background:#edf3fb;border-radius:4px;font-size:.9em}.am-ng pre code{background:transparent;color:inherit}
.am-ng .markdown-body blockquote{border-left:3px solid #b5caf4;background:#f7faff;color:#68778b;padding:12px 18px}
.am-ng .problem-title{margin:25px 0 12px;font-size:28px;color:var(--ng-ink)}.am-ng .problem-limit,.am-ng .problem-limit+p{color:var(--ng-muted);font-size:12px}
.am-ng .btn{border-radius:7px;padding:8px 14px;font-size:13px;background-image:none!important;text-shadow:none;box-shadow:none!important;white-space:nowrap}
.am-ng .btn-primary{background:var(--ng-blue);border-color:var(--ng-blue);color:#fff}.am-ng .btn-primary:hover{background:#1945b0}
.am-ng .btn-default{background:#fff;border-color:#dfe6f0;color:#53637a}.am-ng .btn-default.active{background:var(--ng-soft);border-color:#aec6f6;color:var(--ng-blue)}
.am-ng .btn-success{background:#e9f7f1;border-color:#c4e8d7;color:#167452}.am-ng .btn-danger{background:#fff0f3;border-color:#f4cbd2;color:#b73951}
.am-ng a[ng-repeat="problem in Contest.data.problems"]{margin:0 4px 7px 0;min-width:38px}
.am-ng .form-control{height:auto;min-height:36px;padding:7px 10px;border:1px solid #dce3ed;border-radius:7px;box-shadow:none;color:var(--ng-ink);background:#fff;font-size:13px}
.am-ng .form-control:focus{border-color:#8daff0;box-shadow:0 0 0 3px #edf3ff}.am-ng textarea.form-control{line-height:1.8;resize:vertical}
.am-ng .form-control[disabled]{background:#f7f9fc;color:#596981}
.am-ng .list-group-item{background:#fff;border-color:var(--ng-line);color:#5b6b82}.am-ng .list-group-item.active{background:var(--ng-soft)!important;color:var(--ng-blue)!important;border-color:#c8d8f6;text-shadow:none}
.am-ng .am-ng-table-wrap{position:relative;overflow:auto;max-width:100%;border:1px solid var(--ng-line);border-radius:10px;margin:18px 0}
.am-ng .am-ng-table-wrap>table{display:table!important;margin:0!important;border:0!important;width:100%;background:#fff;font-size:13px}
.am-ng table thead input.form-control{min-width:120px}.am-ng table thead select.form-control{min-width:90px}
.am-ng table>thead>tr>td,.am-ng table>thead>tr>th{padding:12px!important;border:0!important;border-bottom:1px solid var(--ng-line)!important;background:#f7f9fc!important;color:var(--ng-muted);font-size:12px;font-weight:550;vertical-align:middle}
.am-ng table>tbody>tr>td{padding:12px!important;border:0!important;border-bottom:1px solid #edf0f5!important;background:#fff;color:#34425a;vertical-align:middle}
.am-ng table>tbody>tr:last-child>td{border-bottom:0!important}.am-ng table.table-hover>tbody>tr:hover>td{background:#f8faff}
.am-ng table>tbody>tr>td.success{background:#edf8f1;color:#24794e}.am-ng table>tbody>tr>td.danger{background:#fdf0f2;color:#b14a5c}.am-ng table>tbody>tr>td.warning{background:#fff7e9;color:#986b20}.am-ng table>tbody>tr>td.info{background:#eaf3ff;color:#2464ae}
.am-ng .red-td{color:#b84d61}.am-ng .green-td{color:#a07526}.am-ng .blue-td{color:#188063}
.am-ng .pagination>li>a{border-color:var(--ng-line);color:#536b91;font-size:12px}.am-ng .pagination>.active>a{background:var(--ng-blue);border-color:var(--ng-blue);color:#fff}
.am-ng .popover,.am-ng .modal-content{border:1px solid var(--ng-line);border-radius:10px;box-shadow:0 12px 40px #1c34551c}
.am-ng :focus-visible{outline:2px solid #497ce0;outline-offset:3px}
@media(max-width:1200px){.am-ng body>.container-fluid{padding:0 20px 80px}.am-ng [ng-view]{grid-template-columns:210px minmax(0,1fr);gap:20px}.am-ng [ng-view]>nav{margin:0 -20px;padding:10px 20px}.am-ng [ng-view]>nav .navbar-brand{margin-right:0}.am-ng .navbar-default .navbar-nav>li>a{padding:14px 8px}.am-ng [ng-view]>.col-lg-10{padding:22px}}
@media(max-width:1000px){.am-ng [ng-view]>nav .navbar-brand:after{font-size:0}.am-ng [ng-view]>nav .navbar-brand{padding-right:4px}.am-ng .am-ng-reset{font-size:11px;padding:5px}}
@media(max-width:767px){.am-ng body>.container-fluid{padding:0 14px 80px}.am-ng [ng-view]{display:block}.am-ng [ng-view]>nav{position:relative;margin:0 -14px 18px;padding:9px 14px}.am-ng [ng-view]>nav .navbar-brand:after{font-size:23px}.am-ng [ng-view]>.col-lg-2{position:static;max-height:none;margin-bottom:20px}.am-ng [ng-view]>.col-lg-2>h4{font-size:18px;margin-bottom:12px}.am-ng [ng-view]>.col-lg-2>.form-horizontal{display:flex;overflow:auto;gap:4px;padding:5px}.am-ng [ng-view]>.col-lg-2>.form-horizontal>.list-group-item{white-space:nowrap;flex-shrink:0;padding:8px 12px}.am-ng [ng-include="'detail/time.html'"]{display:flex;margin-top:12px}.am-ng [ng-include="'detail/time.html'"]>label{flex:1;min-width:0;padding:10px 5px!important}.am-ng [ng-include="'detail/time.html'"] label label{font-size:11px}.am-ng [ng-include="'detail/time.html'"]>label:last-child>label:last-of-type{font-size:14px}.am-ng [ng-view]>.col-lg-10{padding:20px 16px;min-height:0}.am-ng h1,.am-ng .problem-title{font-size:23px}.am-ng .markdown-body{font-size:14px}.am-ng h3{font-size:21px}}
@media print{.am-ng nav,.am-ng [ng-view]>.col-lg-2{display:none!important}.am-ng [ng-view]{display:block}.am-ng [ng-view]>.col-lg-10{border:0}.am-ng .am-ng-table-wrap{overflow:visible}}
`;
  document.head.append(style);document.documentElement.classList.add('am-ng');
  control.textContent='恢复原版外观';control.className='am-ng-reset';control.addEventListener('click',()=>toggle(true));
  const enhance=()=>{
    const nav=document.querySelector('[ng-view]>nav .navbar-middle');
    if(nav&&!control.isConnected){const li=document.createElement('li');li.append(control);nav.append(li);}
    // Keep original table nodes and all Angular bindings; only add a scroll container.
    for(const table of document.querySelectorAll('[ng-view]>.col-lg-10 table')){
      if(table.closest('.am-ng-table-wrap,.modal,.popover')||table.parentElement.closest('table'))continue;
      const wrap=document.createElement('div');wrap.className='am-ng-table-wrap';table.before(wrap);wrap.append(table);
    }
  };
  let pending=false;
  const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;enhance();});}});
  observer.observe(document.body,{childList:true,subtree:true});enhance();
})();
