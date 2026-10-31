import {readFileSync} from 'node:fs';
import {validateCoordination} from './check-operations.mjs';
import './check-operations.test.mjs';

// Vercel serializes this config before invoking the build command. Keep the
// repository bytes identical, so the full-source digest requires no exception.
const source = readFileSync('vercel.json', 'utf8');
if(source !== JSON.stringify(JSON.parse(source)) + '\n') {
  throw new Error('vercel.json must use JSON.stringify output plus one newline; see docs/release-runbook.md.');
}
console.log('Vercel configuration source bytes: PASS.');

// This is a structural operating check, not a second product acceptance engine.
const coordination = JSON.parse(readFileSync('operations/coordination.json', 'utf8'));
const errors = validateCoordination(coordination, {root: process.cwd()});
if (errors.length) throw new Error(errors.join('\n'));
console.log('Coordination structure verified; product acceptance remains separate.');
