export function createBatchCore() {
  function pairFiles(files, existingNames = []) {
    const groups = new Map(), ignored = [], errors = [], used = new Set();
    const existing = new Set(existingNames.map(n => n.toLowerCase()));
    let bytes = 0;
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      const parts = path.split('/');
      if (parts.some(p => p.startsWith('.'))) { ignored.push(path); continue; }
      const match = file.name.match(/^(.+)\.(in|ans|out)$/i);
      if (!match) { ignored.push(path); continue; }
      const name = file.name.toLowerCase();
      if (used.has(name)) errors.push(`文件名重复：${file.name}（上传后不保留目录）`);
      if (existing.has(name)) errors.push(`与已存在的文件重名：${file.name}`);
      used.add(name);
      const key = path.slice(0, path.length - match[2].length - 1);
      const pair = groups.get(key) || { key, input: null, output: null };
      const side = match[2].toLowerCase() === 'in' ? 'input' : 'output';
      if (pair[side]) errors.push(`同一测试点有多个${side === 'input' ? '输入' : '答案'}文件：${key}`);
      pair[side] = file;
      bytes += file.size;
      groups.set(key, pair);
    }
    const pairs = [...groups.values()].sort((a,b) => a.key.localeCompare(b.key, 'en', {numeric:true}));
    for (const pair of pairs) {
      if (!pair.input || !pair.output) errors.push(`缺少${pair.input ? '.ans 或 .out' : '.in'}：${pair.key}`);
    }
    if (!pairs.length) errors.push('没有找到测试点。请选择同名 .in 与 .ans／.out 文件；压缩包请先解压。');
    return { pairs, ignored, errors, bytes };
  }
  return { pairFiles };
}
