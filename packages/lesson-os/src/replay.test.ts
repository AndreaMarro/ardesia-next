import {describe, expect, it} from 'vitest';
import {type CoreEvent, type EducationalObject, type RecordingCapture} from '@ardesia/contracts';
import {projectDocumentRevision, projectRecordingFrame, createRecordingReplay} from './index';

const at = '2026-11-07T10:00:00.000Z';
const base = {title: 'Nota', x: 0, y: 0, width: 200, height: 180, status: 'draft' as const, revision: 1,
  provenance: {origin: 'authored' as const, sources: [], createdBy: 'teacher', createdAt: at}};
const note: EducationalObject = {...base, id: 'note', type: 'note', data: {text: 'Prima previsione'}};
const revised: EducationalObject = {...note, revision: 2, data: {text: 'Spiegazione corretta'}};
const ink: EducationalObject = {...base, id: 'ink', type: 'ink', data: {color: '#203e62', width: 2,
  points: [{x: 0, y: 0, pressure: .2}, {x: 10, y: 5, pressure: .5}, {x: 20, y: 10, pressure: .8}]}};
const connection = {id: 'link', from: 'note', to: 'ink', label: 'Riferimento'};
const event = (revision: number, type: CoreEvent['type'], payload: unknown): CoreEvent => ({id: 'e' + revision, sequence: revision + 10,
  documentId: 'lesson', documentRevision: revision, actorId: 'teacher', occurredAt: at, type, payload: payload as CoreEvent['payload']});
const events: CoreEvent[] = [event(1, 'create-document', {title: 'Energia'}), event(2, 'add-object', {object: note}),
  event(3, 'add-object', {object: ink}), event(4, 'replace-object', {previous: note, object: revised}),
  event(5, 'connect-objects', {connection}), event(6, 'remove-object', {previous: ink, removedConnections: [connection]}),
  event(7, 'rename-document', {previousTitle: 'Energia', title: 'Conservazione'})];
const capture: RecordingCapture = {format: 'ardesia-recording-v1', recordingId: 'recording', documentId: 'lesson', title: 'Spiegazione',
  capturedAt: at, baseRevision: 2, endRevision: 7, durationMs: 4000, mimeType: 'audio/webm;codecs=opus',
  parts: [{index: 0, sha256: 'a'.repeat(64), bytes: 128}],
  timeline: [{eventId: 'e3', atMs: 1500, timing: 'captured', ink: {objectId: 'ink', objectRevision: 1, sampleTimesMs: [500, 1000, 1500]}},
    {eventId: 'e4', atMs: 2000, timing: 'captured'}, {eventId: 'e5', atMs: 2500, timing: 'observed'},
    {eventId: 'e6', atMs: 3000, timing: 'captured'}, {eventId: 'e7', atMs: 3500, timing: 'captured'}]};

describe('LessonOS exact document and timed ink replay', () => {
  it('rebuilds the initial revision and exact final scene from Core events', () => {
    expect(projectDocumentRevision(events, 'lesson', 2)).toMatchObject({revision: 2, title: 'Energia', objects: [note], connections: []});
    expect(projectDocumentRevision(events, 'lesson', 7)).toMatchObject({revision: 7, title: 'Conservazione', objects: [revised], connections: []});
  });
  it('reveals each sampled ink prefix at its media time with the original pressure and identity', () => {
    expect(projectRecordingFrame(capture, events, 499).objects).toEqual([note]);
    const first = projectRecordingFrame(capture, events, 500).objects.find(value => value.id === 'ink');
    expect(first).toMatchObject({...ink, data: {...ink.data, points: ink.data.points.slice(0, 1)}});
    expect(projectRecordingFrame(capture, events, 1000).objects.find(value => value.id === 'ink')).toMatchObject({data: {points: ink.data.points.slice(0, 2)}});
    expect(projectRecordingFrame(capture, events, 1500).objects).toEqual([note, ink]);
  });
  it('seeks back across edits and deletion; end-state does not leak into earlier playback', () => {
    expect(projectRecordingFrame(capture, events, 2750).connections).toEqual([connection]);
    expect(projectRecordingFrame(capture, events, 3000).objects).toEqual([revised]);
    expect(projectRecordingFrame(capture, events, 1750).objects).toEqual([note, ink]);
    expect(projectRecordingFrame(capture, events, 4000).title).toBe('Conservazione');
    expect(projectRecordingFrame(capture, events, 0).title).toBe('Energia');
  });
  it('does not change inputs or share writable state between projections', () => {
    const original = structuredClone(events), frame = projectRecordingFrame(capture, events, 1750);
    frame.objects[0]!.title = 'Changed consumer result'; frame.objects.pop();
    expect(events).toEqual(original); expect(projectRecordingFrame(capture, events, 1750).objects).toEqual([note, ink]);
  });
  it('rejects incomplete, duplicate, foreign-owner and inconsistent previous-state events', () => {
    for (const broken of [events.filter(value => value.documentRevision !== 4), events.map(value => value.documentRevision === 4 ? {...value, id: 'e3'} : value),
      events.map(value => value.documentRevision === 4 ? {...value, actorId: 'outsider'} : value),
      events.map(value => value.documentRevision === 4 ? {...value, payload: {previous: {...note, title: 'False previous'}, object: revised}} : value)]) {
      expect(() => projectDocumentRevision(broken, 'lesson', 7)).toThrow();
    }
    expect(() => projectDocumentRevision(events, 'lesson', 8)).toThrow();
    expect(() => projectDocumentRevision(events, 'lesson', 0)).toThrow();
  });
  it('keeps compiled scenes immutable, reuses them between media samples and remains independent of later input changes', () => {
    const original = structuredClone(events), reader = createRecordingReplay(capture, original);
    const frame = reader.frame(1600); expect(reader.frame(1700)).toBe(frame);
    expect(() => {frame.objects[0]!.title = 'changed';}).toThrow();
    original.splice(0); expect(reader.frame(4000).title).toBe('Conservazione');
    expect(reader.frame(0).title).toBe('Energia');
  });
  it('does not substitute latest or silently skip missing timeline revisions', () => {
    expect(() => projectRecordingFrame({...capture, timeline: capture.timeline.slice(1)}, events, 4000)).toThrow();
    expect(() => projectRecordingFrame({...capture, timeline: capture.timeline.map((mark, index) => index ? mark : {...mark, eventId: 'missing'})}, events, 4000)).toThrow();
    expect(() => projectRecordingFrame(capture, events, NaN)).toThrow();
  });
});
