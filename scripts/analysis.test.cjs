const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../frontend/src/utils/analysisTrend.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', output)(mod.exports, mod);
const { analyzeTrend, zoomWindow } = mod.exports;
const points = values => values.map((value, index) => ({ timestamp: index * 300000, value }));

test('zoom stays inside the day, preserves pointer anchor, and respects one-minute minimum', () => {
  assert.deepEqual(zoomWindow([0, 86400000], [0, 86400000], 0.5, 0.25), [10800000, 54000000]);
  assert.deepEqual(zoomWindow([200000, 260000], [0, 86400000], 0.1), [200000, 260000]);
  assert.deepEqual(zoomWindow([100, 60100], [0, 86400000], 10000), [0, 86400000]);
});
test('trend requires three occupied bins and ignores missing or invalid readings', () => {
  assert.equal(analyzeTrend(points([null, 2, NaN, 3])), null);
  assert.equal(analyzeTrend([{ timestamp: 0, value: 1 }, { timestamp: 0, value: 2 }, { timestamp: 0, value: 3 }]), null);
});
test('increasing, decreasing, flat and oscillating measurements', () => {
  const increasing = analyzeTrend(points([1, 2, 3]));
  assert.equal(increasing.label, 'Có xu hướng tăng');
  assert.equal(increasing.slope, 12);
  assert.equal(increasing.change, 2);
  assert.equal(increasing.r2, 1);
  assert.equal(analyzeTrend(points([3, 2, 1])).label, 'Có xu hướng giảm');
  assert.equal(analyzeTrend(points([0, 0, 0])).label, 'Không đổi');
  assert.equal(analyzeTrend(points([1, 3, 1])).label, 'Chưa rõ xu hướng tuyến tính');
});
test('dense sample bursts do not overweight a five-minute bin', () => {
  const baseline = points([1, 2, 3]);
  const burst = Array.from({ length: 100 }, (_, index) => ({ timestamp: index * 1000, value: 1 }));
  assert.deepEqual(analyzeTrend([...baseline, ...burst]), analyzeTrend(baseline));
});
test('sparse observations are flagged instead of claiming an increasing trend', () => {
  const result = analyzeTrend([{ timestamp: 0, value: 1 }, { timestamp: 3600000, value: 2 }, { timestamp: 7200000, value: 3 }]);
  assert.equal(result.label, 'Dữ liệu gián đoạn');
  assert.ok(result.coverage < 0.5);
});
