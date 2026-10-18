// Share the remembered choice across direct/VPN entrances when userscript storage is available.
export function createInterfacePreference({getShared, setShared, local = () => globalThis.localStorage, session = () => globalThis.sessionStorage} = {}) {
  const key = 'am-remember-disabled', sessionKey = 'am-disabled';
  const read = (storage, name) => { try { return storage()?.getItem(name); } catch (_) { return null; } };
  const write = (storage, name, value) => { try { storage()?.setItem(name, value); } catch (_) {} };
  function remembered() {
    try {
      const value = getShared?.(key, null);
      if (value === '1' || value === '0') return value === '1';
    } catch (_) {}
    return read(local, key) === '1';
  }
  function remember(value) {
    const stored = value ? '1' : '0';
    try { setShared?.(key, stored); } catch (_) {}
    write(local, key, stored);
    // Clearing the remembered choice leaves this tab in the original interface.
    write(session, sessionKey, '1');
  }
  function setDisabled(value) {
    if (!value) {
      try { setShared?.(key, '0'); } catch (_) {}
      write(local, key, '0');
    }
    write(session, sessionKey, value ? '1' : '0');
  }
  return {remembered, remember, setDisabled, disabled: () => remembered() || read(session, sessionKey) === '1'};
}

export function mountOriginalInterfaceControl(preference, {document: doc = document, reload = () => location.reload()} = {}) {
  if (doc.getElementById('am-interface-control')) return;
  const style = doc.createElement('style');
  style.textContent = `
#am-interface-control{position:fixed;bottom:20px;left:20px;z-index:1040;display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;max-width:calc(100vw - 40px);box-sizing:border-box;padding:8px 12px;border:1px solid #dce3ed;border-radius:10px;background:#fff;color:#202b40;box-shadow:0 4px 20px #15244020;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
#am-interface-control label{display:flex;align-items:center;gap:8px;min-height:44px;margin:0;font:inherit;cursor:pointer}
#am-interface-control input{width:18px;height:18px;margin:0;accent-color:#2458d3}
#am-interface-control button{min-height:44px;padding:10px 16px;border:0;border-radius:8px;background:#2458d3;color:#fff;font:inherit;cursor:pointer}
#am-interface-control :focus-visible{outline:2px solid #497ce0;outline-offset:3px}
@media print{#am-interface-control{display:none}}
`;
  doc.head.append(style);
  const panel = doc.createElement('div'); panel.id = 'am-interface-control';
  const label = doc.createElement('label');
  const checkbox = doc.createElement('input'); checkbox.type = 'checkbox';
  checkbox.checked = preference.remembered();
  checkbox.addEventListener('change', () => preference.remember(checkbox.checked));
  label.append(checkbox, '记住不使用新版界面');
  const enable = doc.createElement('button'); enable.type = 'button';
  enable.textContent = '启用新版界面';
  enable.addEventListener('click', () => { preference.setDisabled(false); reload(); });
  panel.append(label, enable); doc.body.append(panel);
}
