// Run only in an isolated, clean edit page. Simulates directory metadata; never saves.
(async () => {
  const container=document.getElementById('test_data'), total=document.getElementById('total_files');
  const picker=document.getElementById('am-batch-folder');
  const before=new Set(container.children), counter=window.__number_of_test_data, oldTotal=total.value;
  const bytes=new Uint8Array([0,255,13,10,128]);
  try {
    const selected=new DataTransfer();
    for(const ext of ['in','ans']) {
      const file=new File([bytes],'am-directory-regression.'+ext,{lastModified:123456});
      Object.defineProperty(file,'webkitRelativePath',{value:'测试点/nested/'+file.name});
      selected.items.add(file);
    }
    picker.files=selected.files;picker.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#am-batch-upload .am-batch-actions button:last-child').click();
    for(const side of ['in','out']) {
      const file=document.getElementById('input_file_'+side+Number(counter))?.files[0];
      if(!file||file.webkitRelativePath)throw Error('Directory metadata survived batch fill');
      if(file.lastModified!==123456||String(new Uint8Array(await file.arrayBuffer()))!==String(bytes))throw Error('File changed');
    }
    const data=new FormData(document.querySelector('#form'));
    const body=await new Response(data).text();
    if(!body.includes('filename="am-directory-regression.in"')||body.includes('nested/'))throw Error('Invalid multipart filename');
    return {directoryMetadataRemoved:true,binaryBytesPreserved:true,multipartBasenames:true,networkWrites:0};
  } finally {
    for(const child of [...container.children])if(!before.has(child))child.remove();
    window.__number_of_test_data=counter;total.value=oldTotal;total.setAttribute('value',oldTotal);
    picker.value='';
  }
})()
