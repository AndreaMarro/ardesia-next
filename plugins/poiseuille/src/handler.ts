import {PluginRequestSchema, type PluginResponse} from '@ardesia/plugin-sdk';
import {evaluatePoiseuille, poiseuilleView, PoiseuilleStateError} from './model';

export function handlePoiseuilleRequest(input: unknown): PluginResponse | undefined {
  const parsed = PluginRequestSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const {protocol, requestId, instanceId, state} = parsed.data;
  try {
    const result = evaluatePoiseuille(state);
    return {protocol, requestId, instanceId, ok: true, state: result.state, view: poiseuilleView(result)};
  } catch (error) {
    return {protocol, requestId, instanceId, ok: false, error: {code: error instanceof PoiseuilleStateError ? 'INVALID_STATE' : 'EVALUATION_FAILED',
      message: error instanceof PoiseuilleStateError ? error.message : 'Impossibile valutare il flusso.'}};
  }
}
