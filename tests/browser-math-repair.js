// Run on browser-math-repair.html served from the repository over localhost.
// The inert original body script reproduces the OJ's bootstrap selection bug.
(async()=>{
  const checks=[],check=(name,value)=>{if(!value)throw Error(name);checks.push(name);};
  const settle=async count=>{for(let i=0;i<150;i++){if(window.MathJax?.isReady&&MathJax.Hub.getAllJax().length===count&&!document.querySelector('#am-math-status')){await new Promise(ok=>MathJax.Hub.Queue(ok));return;}await new Promise(ok=>setTimeout(ok,50));}throw Error('MathJax render timeout');};
  const body=document.querySelector('.markdown-body');
  await settle(2);
  check('bundled renderer stays on MathJax 2',MathJax.version==='2.7.7');
  check('original body script does not select its remote CDN configuration',!!document.body.querySelector('script[type="application/x-original-mathjax"]')&&!MathJax.Hub.Startup.params.config);
  check('inline and display equations produce SVG',body.querySelectorAll('.MathJax_SVG svg').length===2);
  check('formula-like code stays literal',body.querySelector('pre code').textContent==='$leave_me$');
  const start=performance.now();body.innerHTML='切题后 $x_1^2+\\sqrt{y}$。';
  await settle(1);check('route/content replacement is rendered',MathJax.Hub.getAllJax(body)[0].originalText==='x_1^2+\\sqrt{y}');
  const editor=document.createElement('div');editor.id='preview';document.body.append(editor);
  editor.innerHTML='$$\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$$';
  await settle(2);check('late editor preview and matrix glyphs render',editor.querySelectorAll('.MathJax_SVG svg').length===1);
  const before=body.innerHTML;await new Promise(ok=>setTimeout(ok,200));
  check('render mutations do not create a re-typesetting loop',body.innerHTML===before&&performance.now()-start<10000);
  check('all runtime resources are bundled',performance.getEntriesByType('resource').every(r=>!r.name.includes('accoding-mathjax.invalid')&&(!/mathjax/i.test(r.name)||new URL(r.name).origin===location.origin)));
  return {passed:checks.length,checks};
})()
