import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';

export const root = process.cwd();
const ignore = new Set(['node_modules', '.git', '.vercel', 'dist', 'artifacts', 'test-results', 'playwright-report']);
export function files(dir = root) {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    if(ignore.has(entry.name) || entry.name.startsWith('.env') || entry.name === 'build-info.json') return [];
    const p = join(dir, entry.name); return entry.isDirectory() ? files(p) : [p];
  }).sort();
}
export function sourceDigest() {
  const hash = createHash('sha256');
  for (const path of files()) hash.update(relative(root, path)).update('\0').update(readFileSync(path)).update('\0');
  return hash.digest('hex');
}
export function commitSha() {
  let sha = process.env.ARDESIA_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if(!sha) {try {sha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();} catch {sha = 'local-uncommitted';}}
  if(sha !== 'local-uncommitted' && !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid source commit SHA');
  return sha;
}
export function identity() {return {commit: commitSha(), sourceDigest: sourceDigest(), generatedAt: new Date().toISOString()};}
