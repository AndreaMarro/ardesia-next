import {readFileSync} from 'node:fs';

// Vercel serializes this config before invoking the build command. Keep the
// repository bytes identical, so the full-source digest requires no exception.
const source = readFileSync('vercel.json', 'utf8');
if(source !== JSON.stringify(JSON.parse(source)) + '\n') {
  throw new Error('vercel.json must use JSON.stringify output plus one newline; see docs/release-runbook.md.');
}
console.log('Vercel configuration source bytes: PASS.');
