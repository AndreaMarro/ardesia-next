type Environment = Record<string, string | undefined>;

export interface E2ETarget {
  mode: 'local' | 'remote';
  origin: string;
  reportPath: string;
  summaryPath: string;
  outputDir: string;
}

const stagingOrigin = 'https://ardesia-next-staging.vercel.app';

/** One target for API requests, page navigation and output paths. Remote runs are explicit. */
export function resolveE2ETarget(env: Environment = process.env): E2ETarget {
  const mode = env.ARDESIA_E2E_MODE ?? 'local';
  if (mode !== 'local' && mode !== 'remote') throw Error('ARDESIA_E2E_MODE must be local or remote.');

  const port = env.PORT || '4173';
  if (mode === 'local' && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    throw Error('Invalid local browser-test port.');
  }
  const localOrigin = `http://127.0.0.1:${Number(port)}`;
  const raw = env.ARDESIA_E2E_BASE_URL ?? (mode === 'local' ? localOrigin : '');
  let url: URL;
  try {url = new URL(raw);} catch {throw Error('Configure an explicit browser-test origin.');}

  // Compare the original text as well: URL normalizes dot segments, default ports and whitespace.
  // Never accept credentials, bypass parameters or a path hidden by that normalization.
  if (url.username || url.password || (raw !== url.origin && raw !== `${url.origin}/`)) {
    throw Error('Browser-test URLs must contain only a canonical origin.');
  }
  if (mode === 'local' && url.origin !== localOrigin) {
    throw Error('Non-local browser testing requires explicit remote mode.');
  }
  if (mode === 'remote' && url.origin !== stagingOrigin) {
    throw Error('Remote browser testing is restricted to the stable staging origin.');
  }
  if (mode === 'remote' && env.ARDESIA_E2E === '1') {
    throw Error('Local browser provisioning cannot be enabled in remote mode.');
  }

  return {
    mode, origin: url.origin,
    reportPath: mode === 'local' ? 'artifacts/e2e.json' : 'artifacts/remote-continuity/playwright.json',
    summaryPath: mode === 'local' ? 'artifacts/browser-evidence.json' : 'artifacts/remote-continuity/result.json',
    outputDir: mode === 'local' ? 'test-results' : 'artifacts/remote-continuity/test-results',
  };
}
