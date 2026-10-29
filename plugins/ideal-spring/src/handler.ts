import {PluginRequestSchema} from '@ardesia/plugin-sdk';
import type {PluginResponse} from '@ardesia/plugin-sdk';
import {evaluateSpring, springView, SpringStateError} from './model';

/** The sole worker command is a deterministic, side-effect-free evaluation. */
export function handleSpringRequest(candidate: unknown): PluginResponse | undefined {
  const request = PluginRequestSchema.safeParse(candidate);
  if (!request.success) return undefined;
  const {protocol, requestId, instanceId, state} = request.data;
  try {
    const result = evaluateSpring(state);
    return {protocol, requestId, instanceId, ok: true, state: result.state, view: springView(result)};
  } catch (error) {
    return {
      protocol, requestId, instanceId, ok: false,
      error: {code: error instanceof SpringStateError ? 'INVALID_STATE' : 'EVALUATION_FAILED', message: error instanceof SpringStateError ? error.message : 'Impossibile valutare lo stato della molla.'},
    };
  }
}
