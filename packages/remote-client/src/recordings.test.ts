import {describe, it, expect, vi} from 'vitest';
import {recordingAccess} from './recordings';
import type {RecordingState} from '@ardesia/contracts';

describe('recording media response boundary', () => {
  it('rechecks authorization after the final asynchronous media hash', async () => {
    let valid = true, release!: (buffer: ArrayBuffer) => void;
    const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => new Promise(resolve => {release = resolve;}));
    const state = {summary: {recordingId: 'take', status: 'ready'}, capture: {mimeType: 'audio/webm', parts: [{index: 0, bytes: 1, sha256: '00'.repeat(32)}]}} as RecordingState;
    const send = vi.fn(async () => ({part: state.capture!.parts[0], base64: 'YQ=='}));
    const api = recordingAccess('owner', 'workspace', send, async () => {if (!valid) throw Error('SESSION_CHANGED');});
    const pending = api.download(state); await vi.waitFor(() => expect(digest).toHaveBeenCalledOnce());
    valid = false; release(new ArrayBuffer(32)); await expect(pending).rejects.toThrow('SESSION_CHANGED'); digest.mockRestore();
  });
});
