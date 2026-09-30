// Runtime URL compatibility for the direct site and BUAA VPN reverse proxy.
// The VPN keeps the upstream app under /https-4000/<opaque-token>/, so absolute
// root requests and pathname checks must be evaluated relative to that prefix.
const ACCODING_DIRECT_ORIGINS = new Set(['https://accoding.buaa.edu.cn:4000','https://accoding-4000.e1.buaa.edu.cn','https://accoding-4000.e2.buaa.edu.cn','https://accoding-4000.e3.buaa.edu.cn']);
const ACCODING_VPN_ORIGIN = 'https://d.buaa.edu.cn';
const ACCODING_VPN_PREFIX = location.origin === ACCODING_VPN_ORIGIN
  ? (location.pathname.match(/^\/https-4000\/[^/]+(?=\/|$)/)?.[0] || '') : '';
const ACCODING_MODERN_IS_APP = ACCODING_DIRECT_ORIGINS.has(location.origin) || Boolean(ACCODING_VPN_PREFIX);
const ACCODING_APP_PATHNAME = ACCODING_VPN_PREFIX
  ? (location.pathname.slice(ACCODING_VPN_PREFIX.length) || '/') : location.pathname;
const accodingPath = path => {
  const value = String(path || '');
  if (!ACCODING_VPN_PREFIX || !value.startsWith('/') || value.startsWith('//') ||
      value===ACCODING_VPN_PREFIX || ['/', '?', '#'].some(suffix=>value.startsWith(ACCODING_VPN_PREFIX+suffix))) return value;
  return ACCODING_VPN_PREFIX + value;
};
const accodingPagePath = value => {
  const pathname = value instanceof URL ? value.pathname : String(value || '');
  return ACCODING_VPN_PREFIX && (pathname===ACCODING_VPN_PREFIX || pathname.startsWith(ACCODING_VPN_PREFIX+'/'))
    ? (pathname.slice(ACCODING_VPN_PREFIX.length) || '/') : pathname;
};

// Existing modules intentionally use same-origin absolute fetch paths. Rebase
// those requests while on the VPN; credentials and relative requests are kept
// unchanged. This also covers modules added later without duplicating prefix logic.
if (ACCODING_VPN_PREFIX) {
  const nativeFetch = window.fetch.bind(window);
  const rebaseUrl=value=>{
    const url=new URL(value);
    if(url.origin===location.origin)url.pathname=accodingPath(url.pathname);
    return url;
  };
  window.fetch = (input, init) => {
    if (typeof input === 'string') {
      if(input.startsWith('/'))input=accodingPath(input);
      else if(/^https?:\/\//.test(input)&&new URL(input).origin===location.origin)input=rebaseUrl(input).href;
    }
    else if(input instanceof URL)input=rebaseUrl(input);
    else if (input instanceof Request && new URL(input.url).origin === location.origin) {
      const url=rebaseUrl(input.url);
      if(url.href!==input.url)input=new Request(url,input);
    }
    return nativeFetch(input, init);
  };
}
