/// <reference lib="webworker" />
import { chooseMove, type AIRequest } from './ai';

self.onmessage = (e: MessageEvent<AIRequest & { id: number }>) => {
  const { id, ...req } = e.data;
  try {
    const move = chooseMove(req);
    (self as DedicatedWorkerGlobalScope).postMessage({ id, move });
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({ id, error: String(err) });
  }
};
