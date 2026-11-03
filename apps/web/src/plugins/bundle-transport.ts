export const bundleTransportHeader = 'ARDESIA-WORKER-PARTS/1\n';
const maximum = 512_000;
const invalid = (): never => {throw new Error('INVALID_BUNDLE_TRANSPORT');};
/** Transport only. The Host must verify the fully reconstructed original bytes. */
export async function decodeBundleTransport(bytes: Uint8Array, read: (path: string, maximum: number) => Promise<Uint8Array>): Promise<Uint8Array> {
  const header = new TextEncoder().encode(bundleTransportHeader);
  if (!header.every((value, index) => bytes[index] === value)) return bytes;
  if (bytes.length > 2_048) return invalid();
  let descriptor: unknown;
  try {descriptor = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(header.length)));} catch {return invalid();}
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) return invalid();
  const d = descriptor as Record<string, unknown>;
  const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= maximum;
  if (Object.keys(d).sort().join(',') !== 'byteLength,path,ranges' || typeof d.path !== 'string'
    || !/^\/plugins\/shared\/[a-f0-9]{64}\.js$/.test(d.path) || !integer(d.byteLength) || d.byteLength === 0
    || !Array.isArray(d.ranges) || d.ranges.length !== 2
    || d.ranges.some(r => !Array.isArray(r) || r.length !== 2 || !integer(r[0]) || !integer(r[1]) || r[0] + r[1] > maximum)
    || d.ranges.reduce((sum: number, r: number[]) => sum + r[1]!, 0) !== d.byteLength) return invalid();
  const container = await read(d.path, maximum);
  if (container.length > maximum || d.ranges.some(r => r[0] + r[1] > container.length)) return invalid();
  const restored = new Uint8Array(d.byteLength); let offset = 0;
  for (const [start, length] of d.ranges as [number, number][]) {restored.set(container.subarray(start, start + length), offset); offset += length;}
  return restored;
}
