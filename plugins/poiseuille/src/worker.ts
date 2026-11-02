import {handlePoiseuilleRequest} from './handler';
import type {PluginResponse} from '@ardesia/plugin-sdk';
const port = globalThis as unknown as {onmessage: (event: MessageEvent<unknown>) => void; postMessage(value: PluginResponse): void};
port.onmessage = event => {const response = handlePoiseuilleRequest(event.data); if (response) port.postMessage(response);};
