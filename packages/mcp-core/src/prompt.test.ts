import {describe, expect, it} from 'vitest';
import {PassThrough, Writable} from 'node:stream';
import {terminalQuestion} from './prompt';

function terminal() {
  let written = '';
  const input = Object.assign(new PassThrough(), {isTTY: true});
  const output = Object.assign(new Writable({write(chunk, _encoding, next) {written += chunk.toString(); next();}}), {isTTY: true});
  return {input, output, written: () => written};
}
describe('Private interactive configuration', () => {
  it('does not echo a password and returns the exact entered string', async () => {
    const io = terminal(), pending = terminalQuestion('Password: ', true, io.input, io.output);
    io.input.write('SYNTHETIC_PASSWORD\n'); expect(await pending).toBe('SYNTHETIC_PASSWORD');
    expect(io.written()).not.toContain('SYNTHETIC_PASSWORD'); io.input.destroy(); io.output.destroy();
  });
  it.each(['EOF', 'Ctrl-D', 'Ctrl-C'])('rejects %s so the caller can remove the file and revoke a new session', async action => {
    const io = terminal(), pending = terminalQuestion('Spazi: ', false, io.input, io.output);
    if (action === 'EOF') io.input.end(); else io.input.write(action === 'Ctrl-D' ? '\u0004' : '\u0003');
    await expect(pending).rejects.toMatchObject({name: 'AbortError'}); io.input.destroy(); io.output.destroy();
  });
  it('refuses noninteractive credential input on the MCP protocol stream', async () => {
    const io = terminal(); io.input.isTTY = false;
    await expect(terminalQuestion('Password: ', true, io.input, io.output)).rejects.toMatchObject({code: 'INTERACTIVE_TERMINAL_REQUIRED'});
    io.input.destroy(); io.output.destroy();
  });
});
