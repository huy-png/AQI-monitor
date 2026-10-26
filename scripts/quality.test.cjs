const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/src/utils/quality.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', code)(mod.exports, mod);
const { summarizeQuality, valueQuality } = mod.exports;
const start = Date.parse('2026-10-15T00:00:00+07:00');
const end = start + 86400000;
const row = (offset, fields = {}) => ({ timestamp: new Date(start + offset).toISOString(), temperature: 0, humidity: 0, pressure: 1000, pm25: 0, pm10: 0, ...fields });
test('zero values and negative temperatures are valid; missing and invalid differ', () => {
  assert.equal(valueQuality(0, 'pm25'), 'valid');
  assert.equal(valueQuality(-5, 'temperature'), 'valid');
  assert.equal(valueQuality(null, 'pm25'), 'missing');
  assert.equal(valueQuality(undefined, 'pm25'), 'missing');
  for (const value of [-1, Infinity, '12']) assert.equal(valueQuality(value, 'pm25'), 'invalid');
  assert.equal(valueQuality(101, 'humidity'), 'invalid');
});
test('five-minute bins count partial records and do not label threshold exceedance invalid', () => {
  const result = summarizeQuality([row(0), row(1000, { pm25: null }), row(300000, { pm25: 999 })], start, end, end);
  assert.equal(result.total, 3);
  assert.equal(result.complete, 2);
  assert.equal(result.buckets[0].total, 2);
  assert.equal(result.buckets[0].incomplete, 1);
  assert.equal(result.covered, 2);
  assert.deepEqual(result.metrics.find(m => m.key === 'pm25'), { key: 'pm25', label: 'PM2.5', valid: 2, missing: 1, invalid: 0 });
});
test('only completed bins contribute to coverage; future and next-day rows are excluded', () => {
  const now = start + 360000;
  const result = summarizeQuality([row(-1), row(0), row(310000), row(500000), row(86400000)], start, end, now);
  assert.equal(result.total, 2);
  assert.equal(result.elapsed, 1);
  assert.equal(result.covered, 1);
  assert.equal(result.buckets[1].total, 1);
  assert.equal(result.buckets.length, 288);
});
test('empty history remains empty rather than indicating perfect quality', () => {
  const result = summarizeQuality([], start, end, end);
  assert.equal(result.total, 0);
  assert.equal(result.complete, 0);
  assert.equal(result.covered, 0);
  assert.equal(result.elapsed, 288);
});
