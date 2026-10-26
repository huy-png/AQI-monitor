// Run inside the backend image. All test records live in a temporary schema.
const assert = require('node:assert/strict');
const { Pool } = require('/app/node_modules/pg');
const { PostgresStore } = require('/app/backend/dist/storage/postgres-store');
const { ArchiveService } = require('/app/backend/dist/readings/archive.service');
const { AlertsService } = require('/app/backend/dist/alerts/alerts.service');
const { ConfigService } = require('/app/node_modules/@nestjs/config');
async function main() {
 const admin = new Pool({connectionString:process.env.POSTGRES_URL});
 const schema = 'verify_' + require('node:crypto').randomBytes(8).toString('hex');
 let store;
 try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.POSTGRES_URL); url.searchParams.set('options', '-c search_path='+schema);
  store = await PostgresStore.open(url.toString());
  const archive = new ArchiveService(store, new ConfigService());
  const alerts = new AlertsService(store);
  const settings = await alerts.getSettings();
  settings.rules.forEach(r => { r.enabled = r.metric === 'temperature'; if(r.enabled){r.lower=null;r.upper=30;r.rise=null;r.fall=null;} });
  await alerts.saveSettings(settings);
  assert.equal((await alerts.getSettings()).rules.find(r=>r.metric==='temperature').upper,30);
  await archive.capture('test-device',{temperature:35,timestamp:1700000000});
  await archive.capture('test-device',{temperature:35,timestamp:1700000000});
  let rows=await archive.history('test-device',{});
  assert.equal(rows.length,1); assert.equal(rows[0].humidity,null);
  await archive.capture('test-device',{temperature:36,timestamp:1700000001});
  const first=await archive.history('test-device',{limit:1});
  const second=await archive.history('test-device',{limit:1,before:first[0].id});
  assert.equal(first[0].temperature,36);assert.equal(second[0].temperature,35);
  assert.equal((await archive.history('test-device',{from:'2023-11-14T22:13:21.000Z'})).length,1);
  assert.equal((await archive.history('other-device',{before:first[0].id})).length,0);
  await alerts.processBatch();
  let events=await alerts.findAll();assert.equal(events.length,1);assert.equal(events[0].read,false);
  await alerts.markRead(events[0].id);assert.equal((await alerts.findAll())[0].read,true);
  await alerts.processBatch();assert.equal((await alerts.findAll()).length,1);
  await store.onModuleDestroy();store=await PostgresStore.open(url.toString());
  const restarted=new ArchiveService(store,new ConfigService());
  await restarted.capture('test-device',{temperature:36,timestamp:1700000001});
  assert.equal((await restarted.history('test-device',{})).length,2);
  await store.ping();
  console.log('PASS: null values, settings, deduplication/restart, date filtering, pagination, device isolation, alerts/cooldown/read state.');
 } finally {
  if(store)await store.onModuleDestroy();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
