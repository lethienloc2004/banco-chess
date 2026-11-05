/// <reference lib="webworker" />
import { analyze, type AIRequest } from './ai';

self.onmessage = (e: MessageEvent<AIRequest & { id: number }>) => {
  const { id, ...req } = e.data;
  try {
    const r = analyze(req);
    (self as DedicatedWorkerGlobalScope).postMessage({ id, ...r });
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({ id, error: String(err) });
  }
};
