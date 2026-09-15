// Local OOXML reader: shared strings, inline strings, cached formula values, multiple sheets.
// No workbook bytes leave the browser. ZIP limits also bound decompression memory.
export async function readClassXlsx(file) {
  if (file.size > 12 * 1024 * 1024) throw new Error('名册文件不能超过 12 MB。');
  const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer);
  const u16 = n => view.getUint16(n, true), u32 = n => view.getUint32(n, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) {end = i; break;}
  }
  if (end < 0) throw new Error('不是有效的 XLSX 文件，请使用 Excel 另存为 .xlsx。');
  if (u16(end + 4) || u16(end + 6)) throw new Error('不支持分卷工作簿。');
  const count = u16(end + 10), entries = new Map(), decoder = new TextDecoder('utf-8');
  if (count > 2000) throw new Error('工作簿文件结构过大。');
  let pos = u32(end + 16), total = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50) throw new Error('工作簿 ZIP 目录损坏。');
    const flags = u16(pos + 8), method = u16(pos + 10), packed = u32(pos + 20), size = u32(pos + 24);
    const len = u16(pos + 28), extra = u16(pos + 30), comment = u16(pos + 32), offset = u32(pos + 42);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + len));
    total += size;
    if (flags & 1 || size > 24 * 1024 * 1024 || total > 64 * 1024 * 1024) throw new Error('工作簿已加密或解压后过大。');
    if (entries.has(name)) throw new Error('工作簿包含重复文件。');
    entries.set(name, {offset, packed, size, method});
    pos += 46 + len + extra + comment;
  }
  async function xml(name, optional = false) {
    const e = entries.get(name);
    if (!e) {if (optional) return null; throw new Error('工作簿缺少 ' + name);}
    if (e.offset + 30 > bytes.length || u32(e.offset) !== 0x04034b50) throw new Error('工作簿内容损坏。');
    const start = e.offset + 30 + u16(e.offset + 26) + u16(e.offset + 28);
    if (start + e.packed > bytes.length) throw new Error('工作簿内容不完整。');
    let content = bytes.subarray(start, start + e.packed);
    if (e.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 XLSX 解压，请更新浏览器。');
      const reader = new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks = []; let length = 0;
      try {for (;;) {const {value, done} = await reader.read(); if (done) break; length += value.length;
        if (length > e.size) throw new Error('工作簿解压大小异常。'); chunks.push(value);}}
      finally {await reader.cancel();}
      content = new Uint8Array(length); let offset = 0; for (const c of chunks) {content.set(c, offset); offset += c.length;}
    } else if (e.method !== 0) throw new Error('不支持此工作簿的压缩方式。');
    if (content.length !== e.size) throw new Error('工作簿解压不完整。');
    const text = decoder.decode(content);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('工作簿 XML 包含不支持的声明。');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('工作簿 XML 无法解析。');
    return doc;
  }
  const tags = (node, name) => [...node.getElementsByTagNameNS('*', name)];
  const text = node => tags(node, 't').map(t => t.textContent).join('');
  const wb = await xml('xl/workbook.xml'), rels = await xml('xl/_rels/workbook.xml.rels'), strings = await xml('xl/sharedStrings.xml', true);
  const shared = strings ? tags(strings, 'si').map(text) : [];
  const paths = new Map(tags(rels, 'Relationship').filter(r => r.getAttribute('TargetMode') !== 'External').map(r => {
    const url = new URL(r.getAttribute('Target'), 'https://xlsx.invalid/xl/workbook.xml');
    return [r.getAttribute('Id'), url.origin === 'https://xlsx.invalid' ? url.pathname.slice(1) : ''];
  }));
  const sheets = [];
  for (const sheet of tags(wb, 'sheet')) {
    const rid = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const path = paths.get(rid); if (!path) continue;
    const doc = await xml(path), rows = [];
    for (const row of tags(doc, 'row')) {
      const index = Number(row.getAttribute('r')) - 1;
      if (!Number.isInteger(index) || index < 0 || index > 10000) throw new Error('工作表超过 10001 行或行号无效。');
      const cells = [];
      for (const c of tags(row, 'c')) {
        const ref = /^([A-Z]+)\d+$/.exec(c.getAttribute('r') || ''); if (!ref) continue;
        let col = 0; for (const letter of ref[1]) col = col * 26 + letter.charCodeAt(0) - 64;
        if (col > 256) throw new Error('工作表超过 256 列。');
        const type = c.getAttribute('t'), raw = tags(c, 'v')[0]?.textContent || '';
        cells[col - 1] = type === 'inlineStr' ? text(c) : type === 's' ? shared[Number(raw)] ?? '' : type === 'e' ? '' : raw;
      }
      rows[index] = cells;
    }
    sheets.push({name: sheet.getAttribute('name') || '工作表', rows: Array.from({length: rows.length}, (_, i) => rows[i] || [])});
  }
  if (!sheets.length) throw new Error('没有可读取的工作表。');
  return sheets;
}
