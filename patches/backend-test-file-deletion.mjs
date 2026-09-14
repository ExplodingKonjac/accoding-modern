// Backend reference patch. NOT included in the browser userscript.
// Adapt the caller to the real controller/model; file paths come from stored test cases.
import path from 'node:path';
import {unlink} from 'node:fs/promises';

export function deletionPlan(cases, deletedIndices) {
  const deleted=new Set(deletedIndices);
  for(const index of deleted)if(!Number.isInteger(index)||index<0||index>=cases.length)throw new Error('Invalid test case index');
  const retained=cases.filter((_,i)=>!deleted.has(i));
  const retainedFiles=new Set(retained.flatMap(c=>[c.input,c.output]));
  const filenames=[...new Set(cases.flatMap((c,i)=>deleted.has(i)?[c.input,c.output]:[]))].filter(name=>!retainedFiles.has(name));
  return {retained,filenames};
}
export async function removeFilesOnce(directory,filenames,remove=unlink) {
  const root=path.resolve(directory);
  // Validate the whole plan before any deletion. Existing records must contain basenames.
  const paths=[...new Set(filenames)].map(name=>{
    if(typeof name!=='string'||!name||name==='.'||name==='..'||name.includes('/')||name.includes('\\')||name.includes('\0'))throw new Error('Invalid stored filename');
    const full=path.resolve(root,name);
    if(path.dirname(full)!==root)throw new Error('File outside data directory');
    return full;
  });
  for(const file of paths){
    try{await remove(file);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
}
