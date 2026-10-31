import {identity} from './evidence.mjs';
import {runRemotePreflight} from './remote-preflight.mjs';

/** A direct Playwright invocation must also stop before any application login. */
export default async function setup(config) {
  if (config.projects.some(project => project.use.trace !== 'off' || project.use.serviceWorkers !== 'block')) {
    throw Error('Remote browser checks require tracing off and service workers blocked.');
  }
  const report = await runRemotePreflight({expected: identity()});
  if (!report.passed) throw Error(`Remote browser preflight failed: ${report.failureCode}.`);
}
