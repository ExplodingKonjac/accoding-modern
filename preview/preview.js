// Synthetic data lives only on this origin. No production writes or review calls.
(() => {
  const names=['林同学','周同学','陈同学','许同学','刘同学','宋同学','郑同学','何同学'];
  const members=Array.from({length:36},(_,i)=>({studentId:String(26011001+i),name:names[i%names.length]+(i>=8?' '+(i+1):''),group:'2601'}));
  const key='accoding-modern.classes.v1';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,classes:[{id:'demo-a',name:'26 秋程设 · 2601 班',members},{id:'demo-b',name:'26 秋程设 · 2602 班',members:members.slice(0,24).map((m,i)=>({...m,studentId:String(26012001+i),group:'2602'}))}]}));
  const titles=['数组与循环','字符串处理','函数与递归','结构体基础','排序与查找','综合练习'];
  const competitions=[['1329','C5 · 程序设计基础第五次上机赛','即将开始','2026-10-20 19:00','2026-10-20 21:00'],['1326','E4 · 程序设计基础第四次练习赛','已结束','2026-10-15 08:00','2026-10-18 23:50'],['1323','C4 · 程序设计基础第四次上机赛','已结束','2026-10-13 19:00','2026-10-13 21:00'],['1320','E3 · 程序设计基础第三次练习赛','已结束','2026-10-08 08:00','2026-10-11 23:50'],['1316','C3 · 程序设计基础第三次上机赛','已结束','2026-10-06 19:00','2026-10-06 21:00']];
  const now=Date.now(),end=now-3600000,start=end-7200000;
  const contest=id=>({id:Number(id),title:competitions.find(c=>c[0]===String(id))?.[1]||competitions[1][1],start_time:new Date(String(id)==='1329'?now+86400000:start).toISOString(),end_time:new Date(String(id)==='1329'?now+93600000:end).toISOString(),group_id:124,problems:titles.map((title,i)=>({id:100+i,title,contest_problem_list:{order:i}}))});
  const rank=members.map((m,i)=>({user:{id:1000+i,student_id:m.studentId,nickname:m.name},detail:Object.fromEntries(titles.flatMap((_,j)=>i<(34-j*4)?[[String.fromCharCode(65+j),{result:i<(30-j*5)?'AC':'WA',wrong_count:i%3}]]:[]))}));
  const contestLinks=competitions.map(c=>`<a href="/contest-ng/index.html#/${c[0]}">${c[1]}</a>`).join('');
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url||input,location.href);
    const review=await window.previewReviewService?.(url,options);if(review)return review;
    const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
    if(url.origin!==location.origin){if(url.hostname==='raw.githubusercontent.com')return json({version:'1.22.0'});return new Response('{}',{status:503});}
    if(url.pathname.startsWith('/api/contests/')){
      if(url.pathname.endsWith('server_time'))return json({server_time:new Date().toISOString()});
      if(url.pathname.endsWith('/rank'))return json(rank);
      if(url.pathname.endsWith('/submissions'))return json(members.slice(0,12).map((m,i)=>({id:5000+i,creator_id:1000+i,problem_id:100+i%6,result:i%4?'AC':'WA',created_at:new Date(start+(i+1)*60000).toISOString(),creator:{id:1000+i,nickname:m.name}})));
      return json(contest(url.pathname.match(/contests\/(\d+)/)?.[1]||1326));
    }
    if(url.pathname==='/contest/index')return new Response(contestLinks);
    if(url.pathname==='/submission/index'&&options.method==='POST'){
      const pid=new URLSearchParams(options.body).get('problem_id')||100;
      return new Response(`<input id="problem_id" value="${pid}"><table class="submission-table">${members.slice(0,8).map((m,i)=>`<tr id="tr${6000+i}"><td id="submission_id${6000+i}">${6000+i}</td><td><a href="/user/${1000+i}/index">${m.name}</a></td><td><a href="/problem/${pid}/index">${pid}</a></td><td id="submission_result${6000+i}"><label>Accepted</label></td><td>100</td><td>C</td><td class="standard-format">${new Date(end+60000*(8-i)).toISOString()}</td></tr>`).join('')}</table>`);
    }
    if(options.method&&options.method!=='GET')return new Response('本地预览不提交线上修改',{status:403});
    return nativeFetch(input,options);
  };
  window.GM_xmlhttpRequest=options=>{setTimeout(()=>options.onload?.({status:503,responseText:'{"error":"本地预览未连接复核服务"}'}),100);return {abort(){}};};
  const notice='<div class="preview-notice">本地预览 · 演示数据<a href="/contest/index">赛事列表</a><a href="/contest-ng/index.html#/1326">比赛页</a><a href="/problem/index">题目列表</a><a href="/problem/100/index">题面</a><a href="/problem/100/edit">编辑</a></div>';
  if(/^\/submission\/\d+$/.test(location.pathname)){document.body.replaceChildren();const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=window.previewSubmissionText(location.pathname.split('/').pop());pre.append(code);document.body.append(pre);return;}
  const isContest=location.pathname.startsWith('/contest-ng/');
  const nav=`<nav id="navbar" class="navbar navbar-default"><div class="container-fluid"><div class="navbar-header"><a class="navbar-brand" href="/">ONLINE JUDGE ADMIN</a></div><div class="navbar-collapse"><ul class="nav navbar-nav navbar-middle">${[['group','小组'],['problem','题目'],['contest','赛事'],['submission','评测记录']].map(([path,title])=>`<li><a id="${path}page" href="/${path}/index" class="${location.pathname.startsWith('/'+path)?'nav-change':''}">${title}</a></li>`).join('')}<li><a id="informationpage" href="/user/1000/index">个人信息</a></li></ul><ul class="nav navbar-nav navbar-right"><li><a href="/user/1000/index">演示助教</a></li><li><a href="/user/logout">登出</a></li></ul></div></div></nav>`;
  let page='';
  if(isContest){
    const content=()=>{
      const id=location.hash.match(/\d+/)?.[0]||'1326';
      return `<nav class="navbar navbar-default" ng-include="'detail/nav.html'"></nav><aside class="col-lg-2"><h4>${contest(id).title}</h4><div class="form-horizontal">${[['','比赛简介'],['problems','题目'],['rank','排行榜'],['submissions','提交记录'],['posts','回复与公告']].map(([path,title])=>`<a href="#/${id}${path?'/'+path:''}" class="list-group-item ${location.hash===`#/${id}${path?'/'+path:''}`?'active':''}">${title}</a>`).join('')}</div><div class="text-center" ng-include="'detail/time.html'"><label>服务器当前时间<br><label>2026-10-20 00:30:00</label><br></label><label>比赛结束时间<br><label>2026-10-20 21:00:00</label><br></label><label><label>${id==='1329'?'距离比赛开始':'比赛状态'}</label><br><label>${id==='1329'?'18:30:00':'已结束'}</label></label></div>${location.hash.includes('/problems')?`<div ng-include="'detail/detail-question.html'"></div>`:''}</aside><main class="col-lg-10">${notice}<h1>${location.hash.includes('rank')?'排行榜':location.hash.includes('posts')?'回复与公告':location.hash===`#/${id}`?'比赛简介':'数组与循环'}</h1>${location.hash.includes('rank')?`<table class="table"><thead><tr><th>排名</th><th>同学</th><th>通过</th><th>用时</th></tr></thead><tbody>${members.slice(0,12).map((m,i)=>`<tr><td>${i+1}</td><td>${m.name}</td><td>${6-i%6}</td><td>${30+i*7} min</td></tr>`).join('')}</tbody></table>`:location.hash===`#/${id}`?contestOverview():problemBody()}</main>`;
    };
    document.body.innerHTML='<div class="container-fluid"><div class="row"><div><div ng-view></div></div></div></div>';
    // Match the production ng-include: direct navbar children, delayed loading,
    // both account states, and a fresh set of native nodes on every route.
    const render=()=>{
      document.querySelector('[ng-view]').innerHTML=content();
      const target=document.querySelector('[ng-view]>nav'),id=location.hash.match(/\d+/)?.[0]||'1326';
      const include=()=>{if(target.isConnected)target.innerHTML=`<div class="navbar-header"><a class="navbar-brand" href="/">ONLINE JUDGE</a></div><div class="collapse navbar-collapse" id="nav-ul"><ul class="nav navbar-nav navbar-middle">${[['/','主页'],['/group/index','小组'],['/problem/index','题目'],['/contest/index','赛事'],['/submission/index','评测记录'],['/contest/'+id,'切回原版']].map(([href,title])=>`<li class="${title==='赛事'?'active':''}"><a href="${href}">${title}</a></li>`).join('')}</ul><ul class="nav navbar-nav navbar-right" ng-show="Me.data.id"><li><a href="/user/1000/index">演示助教</a></li><li><a href="/user/logout">登出</a></li></ul><ul class="nav navbar-nav navbar-right ng-hide" ng-hide="Me.data.id"><li><a href="/user/login">登录</a></li><li><a href="/user/register">注册</a></li></ul></div>`;};
      const question=document.querySelector('[ng-include="\'detail/detail-question.html\'"]');
      const includeQuestion=()=>{
        if(!question?.isConnected)return;
        question.innerHTML=`<label class="col-lg-12 col-md-12 col-sm-12 col-xs-12"><div class="row" style="margin-top:10px"><h4 style="display:inline-block">我的提问</h4><button class="btn btn-success pull-right" type="button" ng-click="show_question_area()">提问</button></div></label><div class="col-lg-12 col-md-12 col-sm-12 col-xs-12 ng-hide" ng-show="is_question"><div class="row"><input type="form" class="form-control" placeholder="提问标题" ng-model="question_form.title"><textarea class="form-control" rows="5" placeholder="提问内容" ng-model="question_form.content"></textarea><button type="button" class="btn btn-primary pull-right" ng-click="submit_question_form(order)">提问</button></div></div>`;
        question.querySelector('[ng-click="show_question_area()"]').onclick=()=>question.querySelector('[ng-show="is_question"]').classList.toggle('ng-hide');
      };
      const loadIncludes=()=>{setTimeout(include,100);setTimeout(includeQuestion,150);};
      if(document.readyState==='loading')window.addEventListener('load',loadIncludes,{once:true});else loadIncludes();
    };render();window.addEventListener('hashchange',render);return;
  }
  if(location.pathname==='/contest/index')page=`<h3>赛事管理</h3><table class="table"><tbody><tr><td>比赛 ID</td><td>状态</td><td>比赛名称</td><td>所属小组</td><td>开始时间</td><td>结束时间</td></tr>${competitions.map(c=>`<tr><td>${c[0]}</td><td>${c[2]}</td><td><a href="/contest-ng/index.html#/${c[0]}">${c[1]}</a></td><td><a href="/group/124/index">2026 级程序设计基础</a></td><td>${c[3]}</td><td>${c[4]}</td></tr>`).join('')}</tbody></table><ul class="pagination"><li><a href="?page=1">1</a></li></ul>`;
  else if(location.pathname==='/problem/index')page=`<h3>题目管理</h3><table class="table"><tbody><tr><td>题目 ID</td><td>题目名称</td><td>作者</td><td>权限</td><td>操作</td></tr>${titles.map((t,i)=>`<tr><td>${100+i}</td><td><a href="/problem/${100+i}/index">${t}</a></td><td>演示助教</td><td>组内可见</td><td><a href="/problem/${100+i}/edit">编辑</a></td></tr>`).join('')}</tbody></table>`;
  else if(location.pathname.includes('/edit'))page=`<h3>编辑题目 · 数组与循环</h3><form><label>题目名称<input class="form-control" value="数组与循环"></label><label>题面<textarea id="problem-description" class="form-control markdown-body" name="description" rows="18"># 题目描述\n\n给定 $n$ 个整数，计算它们的和。\n\n## 输入\n第一行为 $n$，第二行为 $n$ 个整数。\n\n## 输出\n输出这些整数的和。</textarea></label><section id="preview" class="markdown-body"></section><details><summary>基本设置</summary><input type="hidden" id="total_files" value="0"><div id="test_data"></div></details><div class="native-actions"><button type="button" class="btn btn-default" id="settingButton">基本设置</button><button type="submit" class="btn btn-primary">保存</button></div><p id="preview-save" role="status"></p></form>`;
  else if(location.pathname.startsWith('/problem/'))page=`<div class="col-lg-2"></div><div class="col-lg-10"><h1>数组与循环</h1><p class="problem-limit">时间限制 1000 ms · 内存限制 256 MB</p><article class="markdown-body">${problemBody()}</article></div><div class="col-lg-2"><div class="native-actions"><a href="/problem/100/edit" class="btn btn-default">编辑题目</a><a href="/submission/index" class="btn btn-primary">查看提交</a></div></div>`;
  else page='<h3>工作台</h3>';
  document.body.innerHTML=nav+`<div id="container"><div class="row"><div></div><div class="col-lg-10"><main id="page">${notice}<div class="col-lg-12">${page}</div></main><footer>Accoding · 本地预览</footer></div></div></div>`;
  window.__number_of_test_data=0;window.add_test_data=()=>{const n=window.__number_of_test_data++,row=document.createElement('div');row.innerHTML=`<label>输入 <input type="file" name="input" id="input_file_in${n}"></label><label>答案 <input type="file" name="output" id="input_file_out${n}"></label><input type="hidden" id="delete-or-not${n}" value="0"><label>权重 <input type="number" value="1"></label>`;document.querySelector('#test_data').append(row);document.querySelector('#total_files').value=window.__number_of_test_data;};
  document.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();document.querySelector('#preview-save').textContent='已验证本地表单。';});
  function contestOverview(){return `<article class="markdown-body"><p>欢迎来到程序设计的世界里。</p><p>本次上机赛将练习程序设计基础，涵盖以下内容：</p><ul><li>IDE 的使用、代码的编写、保存、编译和运行</li><li>基本数据类型</li><li>算术运算符与简单的输入输出</li><li>条件、循环语句</li><li>数组、函数与递归</li></ul><h2>本次比赛的分数设置</h2><table class="table"><thead><tr><th>题目</th>${titles.map((_,i)=>`<th>${String.fromCharCode(65+i)}</th>`).join('')}</tr></thead><tbody><tr><td>分值</td>${[30,20,10,10,10,20].map(score=>`<td>${score}</td>`).join('')}</tr></tbody></table><h2>比赛说明</h2><p>请在左侧选择题目、排行榜或提交记录。遇到困难时，可以先尝试其他题目，再回来检查和调试。</p><p>比赛工具支持投屏展示统计；比赛结束后，可根据权限开启补题。</p></article>`;}
  function problemBody(){return `<article class="markdown-body"><h2>题目描述</h2><p>给定 $n$ 个整数，计算它们的和。</p><h2>输入</h2><p>第一行为整数 $n$，第二行包含 $n$ 个整数 $a_i$。</p><h2>输出</h2><p>输出这些整数的和。</p><h2>样例输入</h2><pre><code>5\n1 2 3 4 5</code></pre><h2>样例输出</h2><pre><code>15</code></pre><h2>数据范围</h2><p>$1 \\le n \\le 10^5$，$|a_i| \\le 10^6$。</p></article>`;}
})();
