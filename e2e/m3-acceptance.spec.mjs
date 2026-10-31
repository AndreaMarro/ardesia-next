import {test, expect} from '@playwright/test';
import {collectBrowserAcceptance} from '../tools/m3-browser.mjs';
import {resolveE2ETarget} from './target.ts';

test('[QA] acceptance collector observes independent sessions and eight browser counterproofs', async ({browser}) => {
  test.setTimeout(180_000);
  const report = await collectBrowserAcceptance({browser, current: {commit: 'a'.repeat(40), sourceDigest: 'b'.repeat(64)},
    deployment: {deploymentId: 'dpl_LocalCollectorTest'}, origin: resolveE2ETarget().origin});
  // This is a loopback collector integration test. It never writes release acceptance artifacts.
  expect(Object.keys(report.sessions).sort()).toEqual(['studentA1', 'studentA2', 'studentB', 'teacher']);
  expect(new Set(Object.values(report.sessions).map(s => s.contextId)).size).toBe(4);
  expect(report.continuity.reopened.stateDigest).toBe(report.continuity.saved.stateDigest);
  expect(report.checks.idor.responseStatus).toBe(404);
  expect(report.checks.logout.afterStatus).toBe(401);
  expect(report.checks.consentRevocation.responseStatus).toBe(422);
  expect(report.checks.revocation.retryStatus).toBe(404);
  expect(report.checks.accountSwitch.responseStatus).toBe(409);
  expect(report.checks.teacherEvidence).toMatchObject({privateCount: 0, sharedCount: 1, afterRevokeCount: 0});
  expect(report.checks.lostResponse.receiptDigest).toBe(report.checks.lostResponse.retriedReceiptDigest);
  expect(report.checks.conflict.persistedRevision).toBe(report.checks.conflict.attemptedRevision + 1);
});
