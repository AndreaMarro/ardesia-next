import {describe, expect, it} from 'vitest';
import {recordingCommandRecovery} from './recovery';
import type {RecordingCommand} from '@ardesia/contracts';

describe('audio command recovery across tabs', () => {
  it('an old ACK cannot erase a new intent; exact bytes survive process restart and remain account scoped', () => {
    const values = new Map<string, string>();
    const storage = {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key, value);},
      removeItem: (key: string) => {values.delete(key);}, key: (index: number) => [...values.keys()][index] ?? null, get length() {return values.size;}};
    const a: RecordingCommand = {kind: 'edit-recording-transcript', commandId: 'a', recordingId: 'take', expectedRevision: 2, origin: 'manual', cues: [{id: 'cue', fromMs: 0, toMs: 1000, text: 'A'}]};
    const b: RecordingCommand = {...a, commandId: 'b', expectedRevision: 3, cues: []};
    const tab1 = recordingCommandRecovery(storage, 'owner', 'workspace'), tab2 = recordingCommandRecovery(storage, 'owner', 'workspace');
    tab1.remember(a); expect(tab2.list('take')).toEqual([a]);
    tab1.acknowledge(a); tab1.remember(b); tab2.acknowledge(a);
    expect(recordingCommandRecovery(storage, 'owner', 'workspace').list('take')).toEqual([b]);
    expect(recordingCommandRecovery(storage, 'other', 'workspace').list('take')).toEqual([]);
    expect(() => tab2.remember({...b, cues: a.cues})).toThrow('già usato');
    expect(tab1.list('take')).toEqual([b]);
  });
});
