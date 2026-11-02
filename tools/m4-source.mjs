import {execFileSync} from 'node:child_process';

/** Materialize a signed source or assigned reuse base in the shallow CI checkout. Never resolve a moving ref. */
export function ensureM4Commit(commit, cwd = process.cwd()) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit)) throw Error('M4 evidence requires an immutable Git SHA');
  const options = {cwd, stdio: 'pipe', timeout: 30000};
  try {execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], options);}
  catch {execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', commit], options);}
  execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], options);
}
