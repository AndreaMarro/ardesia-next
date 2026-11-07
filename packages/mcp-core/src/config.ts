import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {z} from 'zod';

export const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const revision = z.number().int().nonnegative();

/** Configuration, never a tool argument. A canonical origin cannot conceal userinfo or a path. */
export function validOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value && !url.username && !url.password && (url.protocol === 'https:'
      || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && Number(url.port) > 0);
  } catch {return false;}
}
export const OriginSchema = z.string().max(2_000).refine(validOrigin);
export const ConfigSchema = z.object({
  version: z.literal(1), origin: OriginSchema, accountId: id, role: z.enum(['teacher', 'student']),
  sessionToken: digest, workspaceIds: z.array(id).min(1).max(100).refine(ids => new Set(ids).size === ids.length),
  access: z.enum(['read-only', 'read-write']),
}).strict();
export type McpConfig = z.infer<typeof ConfigSchema>;

export class AdapterError extends Error {
  constructor(readonly code: string) {super(code); this.name = 'AdapterError';}
}
export function fail(code: string): never {throw new AdapterError(code);}

/** No symlink, shared permissions, oversized file or silent repair of a broken credential file. */
export async function readConfig(path: string): Promise<McpConfig> {
  if (!isAbsolute(path)) return fail('CONFIGURATION_INVALID');
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await file.stat();
    if (!info.isFile() || info.size > 32_768 || (info.mode & 0o077) !== 0
      || process.getuid && info.uid !== process.getuid()) return fail('CONFIGURATION_INVALID');
    // Bound the read as well as the initial stat: a file may grow between them.
    const bytes = Buffer.alloc(32_769); let used = 0;
    while (used < bytes.length) {
      const {bytesRead} = await file.read(bytes, used, bytes.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > 32_768) return fail('CONFIGURATION_INVALID');
    return ConfigSchema.parse(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, used))));
  } catch {return fail('CONFIGURATION_INVALID');}
  finally {await file?.close();}
}
