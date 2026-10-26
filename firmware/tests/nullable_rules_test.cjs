// Local expression regression checks, not a Firebase Emulator integration test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase/database.rules.json')));
const expression = rules.rules.devices.$deviceId.latest['.validate'];
function snapshot(value) {
  return {
    exists: () => value !== null && value !== undefined,
    val: () => value,
    isString: () => typeof value === 'string',
    isNumber: () => typeof value === 'number' && Number.isFinite(value),
    isBoolean: () => typeof value === 'boolean',
    child: key => snapshot(key.split('/').reduce((node, part) => node?.[part], value)),
    hasChildren: keys => keys ? keys.every(key => value?.[key] != null) :
      (value !== null && typeof value === 'object' && Object.values(value).some(item => item != null)),
  };
}
const base = {};
const allowed = new Set(['temperature', 'humidity', 'pressure', 'pm1', 'pm25', 'pm10', 'latitude', 'longitude']);
// Firebase removes null children; validation is skipped on a deleted node.
const deleted = payload => payload == null || (typeof payload === 'object'
  && Object.values(payload).every(value => value == null));
const check = payload => deleted(payload) ||
  (Object.entries(payload).every(([key, value]) => value == null || allowed.has(key))
  && vm.runInNewContext(expression, {newData: snapshot(payload)}));
assert.equal(rules.rules.devices.$deviceId.latest.$other['.validate'], false);
assert.equal(rules.rules.devices.$deviceId.latest['.write'].includes('newData.exists()'), false,
  'all-null latest must be removable to clear old measurements');
assert.equal(check(base), true, 'all modules absent still allowed');
assert.equal(check({...base, temperature: 25, humidity: 60, pressure: 1000,
  pm1: 0, pm25: 0, pm10: 0, latitude: null, longitude: null}), true, 'GPS absent, zero dust valid');
for (const field of ['temperature', 'humidity', 'pressure', 'pm1', 'pm25', 'pm10', 'latitude', 'longitude']) {
  assert.equal(check({...base, [field]: null}), true, `${field}: null allowed`);
  assert.equal(check({...base, [field]: 'null'}), false, `${field}: string rejected`);
}
for (const [field, value] of Object.entries({humidity: 101, pm1: -1, pm25: -1, pm10: -1, latitude: 91, longitude: -181})) {
  assert.equal(check({...base, [field]: value}), false, `${field}: invalid range rejected`);
}
assert.equal(check({...base, nodeId: 'other'}), false);
assert.equal(check({...base, timestamp: 1785818743}), false);
assert.equal(check({...base, simulated: false}), false);
assert.equal(check({...base, sampleNumber: 1}), false);
console.log('Nullable latest rules expression checks passed.');

for (const scalar of [123, "abc", true, false, 0]) {
  assert.equal(check(scalar), false, 'scalar latest must be rejected');
}
const deviceId = 'esp32-TEST';
const ok = {state: 'ok', ready: true, dataMissing: false, message: 'Du lieu hop le'};
const status = {nodeId: deviceId, timestamp: 1785818743, receivedAt: 1785818743000,
  timestampIso: '2026-08-04T04:45:43Z', simulated: false, sampleNumber: 0,
  lastLatestTimestamp: 0, phase: 'collecting', ready: true, message: 'OK',
  modules: {bme280: {...ok}, pms7003: {...ok}, gps: {...ok}}};
const statusRules = rules.rules.devices.$deviceId.status;
const validateStatus = value => vm.runInNewContext(statusRules['.validate'],
  {newData: snapshot(value), $deviceId: deviceId}) &&
  vm.runInNewContext(statusRules.modules['.validate'], {newData: snapshot(value.modules)}) &&
  Object.entries(value.modules).every(([name, module]) => vm.runInNewContext(
    statusRules.modules.$module['.validate'], {newData: snapshot(module), $module: name}));
assert.equal(validateStatus(status), true);
for (const [field, value] of Object.entries({nodeId: 'wrong', timestamp: -1,
  receivedAt: '123', timestampIso: 123, simulated: 'false', sampleNumber: 1.5,
  lastLatestTimestamp: -1, phase: 'unknown', ready: false})) {
  assert.equal(validateStatus({...status, [field]: value}), false, field);
}
const partial = structuredClone(status);
partial.ready = false;
partial.modules.gps = {state: 'no_fix', ready: false, dataMissing: true, message: 'GPS null'};
assert.equal(validateStatus(partial), true);
partial.modules.gps.dataMissing = false;
assert.equal(validateStatus(partial), false);
const missing = structuredClone(status);
missing.ready = false;
for (const module of Object.values(missing.modules)) {
  module.state = 'no_data'; module.ready = false; module.dataMissing = true;
}
assert.equal(validateStatus(missing), true);
console.log('Latest scalar rejection and status metadata/module checks passed.');
