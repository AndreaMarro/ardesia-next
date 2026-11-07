import {z} from 'zod';
import {isExtensionJson, type ExtensionValue} from './extensions';

export const PROGRAM_RENDERER = 'ardesia.program/1';
export const PROGRAM_VIEW_TAGS = Object.freeze('div section article header footer main p span h1 h2 h3 h4 h5 h6 strong em small code pre blockquote ul ol li dl dt dd table caption thead tbody tfoot tr th td button label input select option textarea output progress meter details summary hr br svg g path circle ellipse rect line polyline polygon text title desc'.split(' '));
export const ProgramStateSchema = z.custom<Record<string,ExtensionValue>>(value =>
  isExtensionJson(value) && value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key => /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)));
/** This is a renderer ABI inside the existing open extension envelope. No code executes during validation. */
export const ProgramBodySchema = z.strictObject({
  code: z.string().min(1).max(32768),
  initialState: ProgramStateSchema,
  intervalMs: z.number().int().min(50).max(60000).optional(),
});
export type ProgramBody = z.infer<typeof ProgramBodySchema>;
export const ProgramEventSchema=z.strictObject({
  type:z.enum(['start','click','input','change','keydown','pointerdown','pointermove','pointerup','tick']),
  action:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/),
  value:z.union([z.string().max(8192),z.number().finite(),z.boolean()]).optional(),
  key:z.string().max(32).optional(),x:z.number().min(0).max(1).optional(),y:z.number().min(0).max(1).optional(),
});
export type ProgramEvent=z.infer<typeof ProgramEventSchema>;
export interface ProgramNode {
  tag:string;
  key?:string;
  attrs?:Record<string,string|number|boolean>;
  style?:Record<string,string|number>;
  events?:Partial<Record<ProgramEvent['type'],string>>;
  children?:Array<ProgramNode|string>;
}
export interface ProgramResult {state:Record<string,ExtensionValue>; view:ProgramNode;}
