// Isolated edit page only. This never saves; the injected failure exercises atomic rollback.
(() => {
  const container=document.getElementById('test_data'), total=document.getElementById('total_files');
  const input=document.getElementById('am-batch-files');
  const original=window.add_test_data, counter=window.__number_of_test_data, oldTotal=total.value;
  const before=container.innerHTML;
  let calls=0;
  try {
    const dt=new DataTransfer();
    for(const name of ['am-rollback-1.in','am-rollback-1.ans','am-rollback-2.in','am-rollback-2.ans'])dt.items.add(new File(['0\n'],name));
    input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    window.add_test_data=()=>{original();if(++calls===2)throw new Error('deliberate test failure');};
    document.querySelector('#am-batch-upload .am-batch-actions button:last-child').click();
    const ok=container.innerHTML===before&&window.__number_of_test_data===counter&&total.value===oldTotal;
    if(!ok)throw new Error('Rollback did not restore all original rows and counters');
    return {atomicRollback:true,networkWrites:0};
  } finally {
    window.add_test_data=original;input.value='';
  }
})()
