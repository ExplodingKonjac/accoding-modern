function mountTestdataGuard(Core) {
  const container=document.getElementById('test_data'),form=container?.closest('form');
  if(!form||document.getElementById('am-testdata-guard'))return;
  const panel=document.createElement('section');panel.id='am-testdata-guard';panel.tabIndex=-1;
  const title=document.createElement('strong');title.textContent='测试点保存检查';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const button=document.createElement('button');button.type='button';button.textContent='检查文件名';button.addEventListener('click',()=>check(false));
  panel.append(title,status,button);(document.getElementById('am-batch-upload')||container).before(panel);
  const style=document.createElement('style');style.textContent=`#am-testdata-guard{padding:14px 16px;margin:14px 0;background:#f5f8fc;border:1px solid #d4dfeb;border-radius:10px;color:#344258;font:13px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}#am-testdata-guard p{white-space:pre-line;margin:7px 0;overflow-wrap:anywhere}#am-testdata-guard[data-level=error],#am-testdata-guard[data-level=warning]{background:#fff8eb;border-color:#e7cfa5;color:#825122}#am-testdata-guard button{font:inherit;border:1px solid #c4d1e1;border-radius:6px;padding:5px 10px;background:#fff;color:#315886;cursor:pointer}`;document.head.append(style);
  const rows=()=>[...container.querySelectorAll('input[name=input]')].map(input=>{
    const index=input.id.match(/(\d+)$/)?.[1],output=document.getElementById('input_file_out'+index);
    return {originalInput:input.getAttribute('value')||'',originalOutput:output?.getAttribute('value')||'',inputUpload:input.files[0]?.name||'',outputUpload:output?.files[0]?.name||'',deleted:document.getElementById('delete-or-not'+index)?.value==='1'};
  });
  function check(reveal=true) {
    const result=Core.inspect(rows());
    panel.dataset.level=result.errors.length?'error':result.warnings.length?'warning':'ok';
    status.textContent=result.errors.length?result.errors.join('\n'):result.warnings.length?result.warnings.join('\n')+'\n可保存其他字段；删除这些记录需要后端修复。检查无法判断文件内容是否已被覆盖或丢失。':'文件名检查通过。保存时将检查所有手动与批量选择的测试点。';
    if(result.errors.length&&reveal){
      const modal=panel.closest('.modal');
      if(modal&&window.jQuery?.fn.modal){window.jQuery(modal).one('shown.bs.modal',()=>{panel.scrollIntoView({block:'center'});panel.focus({preventScroll:true});}).modal('show');}
      else{panel.scrollIntoView({block:'center'});panel.focus({preventScroll:true});}
    }
    return !result.errors.length;
  }
  const originalSave=window.submit_information;
  if(typeof originalSave==='function')window.submit_information=function(){if(check())return originalSave.apply(this,arguments);return false;};
  const originalOnsubmit=form.onsubmit;
  form.onsubmit=function(event){if(!check())return false;return originalOnsubmit?.call(this,event);};
  const originalSubmit=form.submit;
  if(typeof originalSubmit==='function')form.submit=function(){if(check())return originalSubmit.apply(this,arguments);};
  form.addEventListener('submit',event=>{if(!check()){event.preventDefault();event.stopImmediatePropagation();}},true);
  container.addEventListener('change',()=>check(false));
  check(false);
}
