import {z} from 'zod';

export const MATERIAL_PART_BYTES = 512 * 1024;
export const MATERIAL_MAX_BYTES = 32 * 1024 * 1024;
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const MaterialMimeSchema = z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
export const MaterialPageSchema = z.object({width: z.number().finite().positive().max(100_000), height: z.number().finite().positive().max(100_000)}).strict();
export const MaterialManifestSchema = z.object({
  format: z.literal('ardesia-material-v1'), assetId: id, documentId: id,
  name: z.string().trim().min(1).max(240), mimeType: MaterialMimeSchema,
  sha256: digest, bytes: z.number().int().positive().max(MATERIAL_MAX_BYTES),
  license: z.string().trim().min(1).max(300),
  pages: z.array(MaterialPageSchema).min(1).max(1000),
  parts: z.array(z.object({index: z.number().int().nonnegative().max(63), sha256: digest,
    bytes: z.number().int().positive().max(MATERIAL_PART_BYTES)}).strict()).min(1).max(64),
}).strict().superRefine((value, ctx) => {
  if (value.parts.some((part, i) => part.index !== i || i < value.parts.length - 1 && part.bytes !== MATERIAL_PART_BYTES)
    || value.parts.reduce((sum, part) => sum + part.bytes, 0) !== value.bytes
    || value.mimeType !== 'application/pdf' && value.pages.length !== 1) ctx.addIssue({code: 'custom', message: 'Inconsistent material manifest'});
});
export type MaterialManifest = z.infer<typeof MaterialManifestSchema>;
export const MaterialStateSchema = z.object({manifest: MaterialManifestSchema, status: z.enum(['uploading', 'ready']),
  ownerId: id, createdAt: z.iso.datetime()}).strict();
export type MaterialState = z.infer<typeof MaterialStateSchema>;
/** A fixed page of immutable original bytes. View navigation never rewrites this reference. */
export const MaterialDataSchema = z.object({assetId: id, sha256: digest, mimeType: MaterialMimeSchema,
  name: z.string().min(1).max(240), license: z.string().min(1).max(300),
  page: z.number().int().positive().max(1000), pageCount: z.number().int().positive().max(1000),
  pageWidth: z.number().finite().positive().max(100_000), pageHeight: z.number().finite().positive().max(100_000),
}).strict().refine(value => value.page <= value.pageCount && (value.mimeType === 'application/pdf' || value.page === 1 && value.pageCount === 1), 'Invalid material page');
export type MaterialData = z.infer<typeof MaterialDataSchema>;
export function materialPage(manifest: MaterialManifest, page: number): MaterialData {
  const size = manifest.pages[page - 1];
  return MaterialDataSchema.parse({assetId: manifest.assetId, sha256: manifest.sha256, mimeType: manifest.mimeType,
    name: manifest.name, license: manifest.license, page, pageCount: manifest.pages.length, pageWidth: size?.width, pageHeight: size?.height});
}
/** The target is immutable in size/content. Ink coordinates remain in the board's units;
 * this captured origin makes its translation relative to the page, also during replay. */
export const InkAnchorSchema = z.object({objectId: id, x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000)}).strict();
