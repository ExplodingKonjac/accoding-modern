export function createSubmissionCore() {
  function parse(text, expectedId) {
    const header = text.match(/^\/\*\s*\r?\n Author: ([^\r\n]+)\((\d+)\)\r?\n Result: (\S+)\s+Submission_id: (\d+)\r?\n Created at: ([^\r\n]+)\r?\n Problem: (\d+)\s+Time: (\S+)\s+Memory: (\S+)\r?\n\*\//);
    if (!header || header[4] !== String(expectedId) || !Number.isFinite(Date.parse(header[5]))) {
      throw new Error('无法确认本次提交信息，已保留原站源码。');
    }
    return {id:header[4], nickname:header[1], creator_id:header[2], result:header[3],
      timestamp:Date.parse(header[5]), problem_id:header[6], time:header[7], memory:header[8],
      code:text.slice(header[0].length).replace(/^\r?\n\r?\n/, '')};
  }
  function isPrevious(row, current) {
    return String(row.creator_id) === String(current.creator_id) && String(row.problem_id) === String(current.problem_id)
      && Number(row.id) < Number(current.id) && Number.isFinite(row.timestamp) && row.timestamp <= current.timestamp;
  }
  function previous(rows, current) {
    return rows.filter(row=>isPrevious(row,current)).sort((a,b)=>b.timestamp-a.timestamp || Number(b.id)-Number(a.id))[0] || null;
  }
  // The site searches names, so always confirm numeric user IDs and the current row.
  // Walk to the empty last page: its “next” link also exists on the final page.
  async function findPrevious(current, loadPage, signal, progress=()=>{}) {
    const rows=[], seen=new Set();let offset=0, foundCurrent=false;
    for(let page=0;page<1000;page++) {
      signal?.throwIfAborted();
      const packet=await loadPage(offset,signal);progress(page+1);
      if(!packet.rows.length) {
        if(!foundCurrent)throw new Error('原站列表未返回本次提交，无法确认上一份代码，请重试。');
        return previous(rows,current);
      }
      for(const row of packet.rows) {
        if(seen.has(String(row.id)))throw new Error('原站重复返回提交记录，未完成前版查询，请重试。');
        seen.add(String(row.id));rows.push(row);
        if(String(row.id)===String(current.id)) {
          if(String(row.creator_id)!==String(current.creator_id)||String(row.problem_id)!==String(current.problem_id))throw new Error('本次提交身份与列表不一致。');
          foundCurrent=true;
        }
      }
      if(packet.next===null) {
        if(!foundCurrent)throw new Error('原站列表未返回本次提交，无法确认上一份代码，请重试。');
        return previous(rows,current);
      }
      if(!Number.isInteger(packet.next)||packet.next<=offset)throw new Error('提交分页异常，请重试。');
      offset=packet.next;
    }
    throw new Error('提交记录过多，未完成前版查询，请稍后重试。');
  }
  return {parse,isPrevious,previous,findPrevious};
}
