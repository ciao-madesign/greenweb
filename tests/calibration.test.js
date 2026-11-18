import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('../scripts/calibrate-device.py', import.meta.url).pathname;
const run = (file) => JSON.parse(execFileSync('python3', ['-I', script, '--input', file, '--json'], { encoding: 'utf8' }));
const HEADER = 'run_id,device_type,os,browser,adblock,journey,duration_s,energy_j,idle_w,bytes,requests,notes\n';

test('calibrazione: i dati sintetici producono una proposta coerente e segnalata come non utilizzabile', () => {
  const r = run(new URL('../scripts/calibration-sample.synthetic.csv', import.meta.url).pathname);
  const p = r.proposal;
  assert.equal(p.device_power_w.laptop.runs, 18);
  assert.ok(p.device_power_w.laptop.min <= p.device_power_w.laptop.mid && p.device_power_w.laptop.mid <= p.device_power_w.laptop.max);
  assert.ok(p.streaming_device_factor.laptop > 1);
  assert.ok(p.notes.some((n) => n.includes('SINTETICI')));
});

test('calibrazione: propone il fattore di attività solo con abbastanza prove e un buon adattamento', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cal-'));
  // potenza = 8 + 0,004 x richieste/minuto, con 15 prove
  let csv = HEADER;
  for (let i = 0; i < 15; i++) {
    const reqPerMin = 20 + i * 40, dur = 120, w = 8 + 0.004 * reqPerMin;
    csv += `${i},laptop,test,test,no,reading,${dur},${w * dur},0,0,${reqPerMin * (dur / 60)},\n`;
  }
  writeFileSync(join(dir, 'ok.csv'), csv);
  const ok = run(join(dir, 'ok.csv')).proposal.activity_factor.laptop;
  assert.ok(Math.abs(ok.watts_per_request_per_minute - 0.004) < 1e-3 && ok.r2 > 0.99, JSON.stringify(ok));

  // poche prove: nessuna proposta
  writeFileSync(join(dir, 'few.csv'), csv.split('\n').slice(0, 6).join('\n') + '\n');
  assert.equal(typeof run(join(dir, 'few.csv')).proposal.activity_factor.laptop, 'string');

  // nessun legame tra richieste e potenza: nessuna proposta
  let noise = HEADER;
  for (let i = 0; i < 15; i++) noise += `${i},laptop,test,test,no,reading,120,${(10 + (i % 3)) * 120},0,0,${(20 + i * 40) * 2},\n`;
  writeFileSync(join(dir, 'noise.csv'), noise);
  assert.equal(typeof run(join(dir, 'noise.csv')).proposal.activity_factor.laptop, 'string');
});
