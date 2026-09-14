function mountBatchUpload(Core) {
  const container = document.getElementById('test_data');
  const total = document.getElementById('total_files');
  if (!container || !total || typeof window.add_test_data !== 'function' || document.getElementById('am-batch-upload')) return;
  const make = (tag, text) => { const e=document.createElement(tag); if(text!==undefined)e.textContent=text; return e; };
  const panel = make('section'); panel.id='am-batch-upload';
  const heading=make('strong','批量添加测试点');
  const hint=make('p','选择多组同名 .in 与 .ans／.out 文件，自动配对并追加到下方。压缩包请先解压；最后点击原站“保存”上传。');
  const actions=make('div');actions.className='am-batch-actions';
  const files=make('input');files.type='file';files.multiple=true;files.hidden=true;files.id='am-batch-files';
  const folder=make('input');folder.type='file';folder.multiple=true;folder.webkitdirectory=true;folder.hidden=true;folder.id='am-batch-folder';
  const button=(text,handler)=>{const b=make('button',text);b.type='button';b.addEventListener('click',handler);return b;};
  const choose=button('选择多个文件',()=>{files.value='';files.click();});
  const chooseFolder=button('选择文件夹',()=>{folder.value='';folder.click();});
  const apply=button('填入测试点',append);apply.disabled=true;
  const status=make('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const preview=make('div');preview.className='am-batch-preview';
  const style=make('style');style.textContent=`#am-batch-upload{padding:16px;margin:14px 0;border:1px solid #cdddec;border-radius:10px;background:#f4f8fd;color:#344258;font:13px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}#am-batch-upload p{margin:8px 0}#am-batch-upload .am-batch-actions{display:flex;gap:8px;flex-wrap:wrap}#am-batch-upload button{font:inherit;background:white;border:1px solid #bfcee0;border-radius:6px;padding:6px 12px;color:#2858a0;cursor:pointer}#am-batch-upload button:disabled{opacity:.45;cursor:default}#am-batch-upload button:focus-visible{outline:2px solid #387bea;outline-offset:2px}#am-batch-upload [hidden]{display:none!important}#am-batch-upload .am-batch-preview{max-height:220px;overflow:auto}#am-batch-upload table{width:100%;font-size:12px;border-collapse:collapse}#am-batch-upload td,#am-batch-upload th{padding:5px 8px;text-align:left;overflow-wrap:anywhere}#am-batch-upload [role=status]{white-space:pre-line}#am-batch-upload [data-error=true]{color:#b23838}`;
  actions.append(choose,chooseFolder,apply);panel.append(heading,hint,actions,files,folder,status,preview);document.head.append(style);container.before(panel);
  let selection=[];
  const existing=()=>[...container.querySelectorAll('input[type=file]')].flatMap(e=>e.files.length?[...e.files].map(f=>f.name):e.getAttribute('value')?[e.getAttribute('value')]:[]);
  const plan=()=>Core.pairFiles(selection,existing());
  function show() {
    const result=plan();preview.replaceChildren();
    status.dataset.error=String(!!result.errors.length);
    status.textContent=result.errors.length?result.errors.join('\n'):`已配对 ${result.pairs.length} 组 · ${(result.bytes/1024).toFixed(1)} KB`;
    if(result.ignored.length) status.textContent+=`\n忽略 ${result.ignored.length} 个非测试点或隐藏文件。`;
    apply.disabled=!!result.errors.length;apply.textContent=result.errors.length?'填入测试点':`填入 ${result.pairs.length} 组测试点`;
    if(result.pairs.length){const table=make('table'),thead=make('thead'),tr=make('tr');for(const s of ['输入文件','答案文件'])tr.append(make('th',s));thead.append(tr);const body=make('tbody');for(const pair of result.pairs){const row=make('tr');row.append(make('td',pair.input?.name||'缺失'),make('td',pair.output?.name||'缺失'));body.append(row);}table.append(thead,body);preview.append(table);}
  }
  for(const input of [files,folder]) input.addEventListener('change',()=>{if(input.files.length){selection=[...input.files];show();}});
  function append() {
    // Recheck names at commit time: users may have manually added rows since selecting files.
    const result=plan();
    if(result.errors.length){show();return;}
    const start=Number(window.__number_of_test_data), oldCounter=window.__number_of_test_data, oldTotal=total.value;
    const before=new Set(container.children);
    try {
      if(!Number.isInteger(start)||start<0) throw new Error('原站测试点计数不可用，请刷新后重试。');
      // Prepare every FileList before touching the form, then use the site's own row builder.
      const entries=result.pairs.map(pair=>['input','output'].map(side=>{const transfer=new DataTransfer();transfer.items.add(pair[side]);return transfer.files;}));
      entries.forEach((entry,index)=>{
        const n=start+index;
        if(document.getElementById('input_file_in'+n))throw new Error('原站测试点序号发生冲突。');
        window.add_test_data();
        ['in','out'].forEach((side,j)=>{
          const target=document.getElementById('input_file_'+side+n);
          if(!target || target.form!==total.form)throw new Error('原站测试点表单结构已变化。');
          target.files=entry[j];target.dispatchEvent(new Event('change',{bubbles:true}));
        });
      });
      selection=[];files.value='';folder.value='';apply.disabled=true;preview.replaceChildren();
      status.dataset.error='false';status.textContent=`已填入 ${entries.length} 组，权重默认为 1。尚未上传，请检查下方列表，再点击原站“保存”。`;
    } catch(error) {
      for(const child of [...container.children])if(!before.has(child))child.remove();
      window.__number_of_test_data=oldCounter;total.value=oldTotal;total.setAttribute('value',oldTotal);
      status.dataset.error='true';status.textContent='填入失败，已撤销本次新增行。'+error.message;
    }
  }
}
