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
  if (!ACCODING_VPN_PREFIX || !value.startsWith('/') || value.startsWith(ACCODING_VPN_PREFIX + '/')) return value;
  return ACCODING_VPN_PREFIX + value;
};
const accodingPagePath = value => {
  const pathname = value instanceof URL ? value.pathname : String(value || '');
  return ACCODING_VPN_PREFIX && pathname.startsWith(ACCODING_VPN_PREFIX)
    ? (pathname.slice(ACCODING_VPN_PREFIX.length) || '/') : pathname;
};

// Existing modules intentionally use same-origin absolute fetch paths. Rebase
// those requests while on the VPN; credentials and relative requests are kept
// unchanged. This also covers modules added later without duplicating prefix logic.
if (ACCODING_VPN_PREFIX) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') input = accodingPath(input);
    else if (input instanceof Request && new URL(input.url).origin === location.origin) {
      const url = new URL(input.url);
      if (!url.pathname.startsWith(ACCODING_VPN_PREFIX + '/')) {
        url.pathname = accodingPath(url.pathname);
        input = new Request(url, input);
      }
    }
    return nativeFetch(input, init);
  };
}
