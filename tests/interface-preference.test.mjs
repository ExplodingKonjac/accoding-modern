import test from 'node:test';
import assert from 'node:assert/strict';
import {createInterfacePreference} from '../src/interface-preference.mjs';

function storage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
}
const setup = (local = storage(), session = storage(), shared) => ({
  local, session,
  preference: createInterfacePreference({local: () => local, session: () => session,
    getShared: shared && ((key, fallback) => shared.getItem(key) ?? fallback),
    setShared: shared && ((key, value) => shared.setItem(key, value))})
});

test('new installations use the modern interface; existing temporary opt-out stays temporary', () => {
  const s = setup(); assert.equal(s.preference.disabled(), false);
  s.session.setItem('am-disabled', '1');
  assert.equal(s.preference.disabled(), true); assert.equal(s.preference.remembered(), false);
  assert.equal(setup(s.local).preference.disabled(), false);
});

test('remembered opt-out survives fresh tabs and script instances', () => {
  const s = setup(); s.preference.remember(true);
  const reopened = setup(s.local);
  assert.equal(reopened.preference.disabled(), true);
  assert.equal(reopened.preference.remembered(), true);
});

test('userscript storage shares the choice with a separate direct or VPN origin', () => {
  const shared = storage(), direct = setup(storage(), storage(), shared);
  direct.preference.remember(true);
  const vpn = setup(storage(), storage(), shared);
  assert.equal(vpn.preference.disabled(), true);
  vpn.preference.setDisabled(false);
  assert.equal(setup(direct.local, storage(), shared).preference.disabled(), false);
});

test('unchecking the switch preserves only the current tab opt-out', () => {
  const s = setup(); s.preference.remember(true); s.preference.remember(false);
  assert.equal(s.preference.remembered(), false);
  assert.equal(s.preference.disabled(), true);
  assert.equal(setup(s.local).preference.disabled(), false);
});

test('enabling the modern interface clears both remembered and temporary opt-outs', () => {
  const shared = storage(), s = setup(storage(), storage(), shared);
  s.preference.remember(true); s.preference.setDisabled(false);
  assert.equal(s.preference.disabled(), false);
  assert.equal(setup(s.local, storage(), shared).preference.disabled(), false);
});

test('temporary restoration does not opt in to remembering', () => {
  const s = setup(); s.preference.setDisabled(true);
  assert.equal(s.preference.disabled(), true); assert.equal(s.preference.remembered(), false);
  assert.equal(setup(s.local).preference.disabled(), false);
});

test('local storage is a fallback when userscript storage throws', () => {
  const local = storage();
  const s = createInterfacePreference({local: () => local, session: () => storage(),
    getShared() { throw Error('unavailable'); }, setShared() { throw Error('unavailable'); }});
  s.remember(true); assert.equal(s.disabled(), true);
  assert.equal(setup(local).preference.disabled(), true);
  s.setDisabled(false); assert.equal(s.disabled(), false);
});

test('blocked browser storage does not break page startup or controls', () => {
  const unavailable = () => { throw Error('SecurityError'); };
  const s = createInterfacePreference({local: unavailable, session: unavailable});
  assert.equal(s.disabled(), false);
  assert.doesNotThrow(() => { s.remember(true); s.setDisabled(false); });
});

test('an explicit shared false overrides a stale origin-local true', () => {
  const shared = storage(), s = setup(storage(), storage(), shared);
  s.local.setItem('am-remember-disabled', '1');
  shared.setItem('am-remember-disabled', '0');
  assert.equal(s.preference.disabled(), false);
});
