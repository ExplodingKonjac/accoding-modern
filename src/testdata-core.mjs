export function createTestdataCore() {
  function inspect(rows) {
    const refs=new Map(), errors=[], warnings=[];
    rows.forEach((row,index)=>{
      for(const name of [row.originalInput,row.originalOutput])if(name){const uses=refs.get(name)||[];uses.push(index);refs.set(name,uses);}
    });
    for(const [name,uses] of refs){
      if(uses.length>1){
        const message=`已有文件 ${name} 被重复引用（测试点 ${[...new Set(uses)].map(i=>i+1).join('、')}）。`;
        warnings.push(message);
        if(uses.some(i=>rows[i].deleted))errors.push(message+' 当前后端可能重复删除文件或损坏保留的测试点，已阻止保存；需要服务端修复删除逻辑。');
      }
    }
    const uploads=new Set();
    rows.forEach((row,index)=>{
      const names=[row.inputUpload,row.outputUpload];
      if(!row.originalInput&&!row.originalOutput&&!row.deleted&&(!names[0]||!names[1]))errors.push(`测试点 ${index+1} 缺少输入或答案文件。`);
      for(const name of names){
        if(!name)continue;
        if(refs.has(name))errors.push(`新文件 ${name} 与已有文件重名；即使旧点标记删除，也不能在同一次保存中覆盖。`);
        if(uploads.has(name))errors.push(`本次上传重复使用文件名 ${name}；输入和答案也必须使用不同文件名。`);
        uploads.add(name);
      }
    });
    return {errors:[...new Set(errors)],warnings};
  }
  return {inspect};
}
