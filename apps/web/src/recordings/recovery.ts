import {canonicalJson, RecordingCommandSchema, type RecordingCommand} from '@ardesia/contracts';

/** Local retry envelopes, keyed by immutable command identity; never a confirmed recording ledger. */
export function recordingCommandRecovery(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>, accountId: string, workspaceId: string) {
  const prefix = `ardesia-next-audio-command:${accountId}:${workspaceId}:`;
  const key = (command: RecordingCommand) => prefix + command.recordingId + ':' + command.commandId;
  return {
    remember(input: RecordingCommand) {
      const command = RecordingCommandSchema.parse(input), bytes = canonicalJson(command), prior = storage.getItem(key(command));
      if (prior !== null && prior !== bytes) throw Error('L’identificatore della richiesta audio è già usato. Recupera il comando originale.');
      storage.setItem(key(command), bytes); return command;
    },
    list(recordingId: string) {
      const found: RecordingCommand[] = [];
      for (let index = 0; index < storage.length; index++) {
        const name = storage.key(index); if (!name?.startsWith(prefix + recordingId + ':')) continue;
        const command = RecordingCommandSchema.parse(JSON.parse(storage.getItem(name)!));
        if (name !== key(command) || command.recordingId !== recordingId) throw Error('Recupero audio non valido. L’originale locale è conservato.');
        found.push(command);
      }
      return found;
    },
    acknowledge(command: RecordingCommand) {
      // A late acknowledgement cannot erase another tab's newer command.
      if (storage.getItem(key(command)) === canonicalJson(command)) storage.removeItem(key(command));
    },
  };
}
