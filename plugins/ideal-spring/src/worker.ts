import type {PluginResponse} from '@ardesia/plugin-sdk';
import {handleSpringRequest} from './handler';

const port = globalThis as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(response: PluginResponse): void;
};

port.onmessage = event => {
  const response = handleSpringRequest(event.data);
  if (response) port.postMessage(response);
};
