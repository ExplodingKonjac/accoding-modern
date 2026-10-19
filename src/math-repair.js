// VPN reverse proxies rewrite external MathJax script/font URLs. The bundled
// MathJax 2 SVG renderer uses local glyph paths and keeps the site's Hub API.
function createMathRepair(bundledSource) {
  const vpn=Boolean(ACCODING_VPN_PREFIX)||/^https:\/\/accoding-4000\.e[123]\.buaa\.edu\.cn$/.test(location.origin);
  const bodySelector='.markdown-body:not(textarea),#preview';
  const mathSelector='.MathJax,.MathJax_Display,.MathJax_Preview,.MathJax_SVG,.MathJax_SVG_Display,.MJX_Assistive_MathML,[id^="MathJax-"]';
  let ready=null,timer=null,working=false;
  const pending=new Set();
  async function ensure(){
    if(ready)return ready;
    ready=(async()=>{
      let math=pageWindow.MathJax;
      if(vpn||!math?.Hub?.Queue){
        if(math?.Hub?.getAllJax)for(const jax of math.Hub.getAllJax())jax.Remove();
        // MathJax scans scripts backwards across the whole document. Place this
        // after the original body script so its CDN config query is not reused.
        const marker=document.createElement('script');marker.type='application/x-accoding-mathjax';
        marker.src='https://accoding-mathjax.invalid/MathJax.js';document.body.append(marker);
        pageWindow.MathJax={root:'https://accoding-mathjax.invalid',skipStartupTypeset:true,showMathMenu:false,
          jax:['input/TeX','output/SVG'],extensions:[],menuSettings:{renderer:'SVG',locale:'en'},
          tex2jax:{inlineMath:[['$','$'],['\\(','\\)']],displayMath:[['$$','$$'],['\\[','\\]']],processEscapes:true},
          SVG:{font:'TeX',useGlobalCache:false}};
        try{pageWindow.eval(bundledSource);}finally{marker.remove();}
        math=pageWindow.MathJax;
        math.Hub.Register.StartupHook('End Cookie',()=>{
          math.Hub.config.jax=['input/TeX','output/SVG'];math.Hub.config.menuSettings.renderer='SVG';
        });
      }
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('公式渲染初始化超时。')),15000);
        math.Hub.Queue(()=>{clearTimeout(timeout);resolve();});
      });
      return math;
    })();
    return ready;
  }
  function status(error){
    let notice=document.getElementById('am-math-status');
    if(!notice){notice=document.createElement('p');notice.id='am-math-status';notice.setAttribute('role','status');
      notice.style.cssText='padding:10px 14px;background:#fff4dc;color:#714b10;border:1px solid #e5cf9f;border-radius:8px';
      const body=document.querySelector(bodySelector);body?.before(notice);}
    notice.textContent='公式渲染失败，请刷新页面重试。'+error.message;
  }
  async function flush(){
    timer=null;if(working)return;
    const nodes=[...pending].filter(n=>n.isConnected);pending.clear();
    if(!nodes.length)return;
    working=true;
    try{
      const math=await ensure();
      await new Promise(resolve=>math.Hub.Queue(...nodes.filter(n=>n.isConnected).map(n=>['Typeset',math.Hub,n]),resolve));
    }catch(error){status(error);}
    finally{working=false;if(pending.size)timer=setTimeout(flush,60);}
  }
  function typeset(nodes){for(const n of nodes)if(n?.isConnected)pending.add(n);if(!timer&&!working)timer=setTimeout(flush,60);}
  const element=n=>n?.nodeType===1?n:n?.parentElement;
  const mathNode=n=>Boolean(element(n)?.matches?.(mathSelector)||element(n)?.closest?.(mathSelector));
  const add=(node,bodies)=>{
    const el=element(node);if(!el||mathNode(el))return;
    const nearest=el.closest?.(bodySelector);if(nearest)bodies.add(nearest);
    el.querySelectorAll?.(bodySelector).forEach(n=>bodies.add(n));
  };
  if(window.MutationObserver){
    const observer=new MutationObserver(records=>{
      const bodies=new Set();
      for(const record of records){
        if(mathNode(record.target))continue;
        if(record.addedNodes.length&&[...record.addedNodes].every(mathNode))continue;
        if(!record.addedNodes.length&&record.removedNodes.length&&[...record.removedNodes].every(mathNode))continue;
        add(record.target,bodies);record.addedNodes.forEach(n=>add(n,bodies));
      }
      typeset([...bodies]);
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  typeset([...document.querySelectorAll(bodySelector)]);
  return {typeset};
}
