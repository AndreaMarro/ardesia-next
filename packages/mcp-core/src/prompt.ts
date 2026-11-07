import {createInterface} from 'node:readline/promises';
import {Readable, Writable} from 'node:stream';
import {fail} from './config';

/** TTY input stays outside the MCP protocol; EOF and Ctrl-C must release configure's cleanup. */
export async function terminalQuestion(prompt: string, hidden = false,
  input: Readable & {isTTY?: boolean} = process.stdin, terminalOutput: Writable & {isTTY?: boolean} = process.stderr): Promise<string> {
  if (!input.isTTY || !terminalOutput.isTTY) return fail('INTERACTIVE_TERMINAL_REQUIRED');
  let muted = false;
  const output = new Writable({write(chunk, _encoding, callback) {if (!muted) terminalOutput.write(chunk); callback();}});
  const readline = createInterface({input, output, terminal: true}), interrupted = new AbortController();
  readline.once('close', () => interrupted.abort());
  readline.once('SIGINT', () => interrupted.abort());
  try {
    const result = readline.question(prompt, {signal: interrupted.signal}); muted = hidden;
    return await result;
  } finally {muted = false; readline.close(); if (hidden) terminalOutput.write('\n');}
}
