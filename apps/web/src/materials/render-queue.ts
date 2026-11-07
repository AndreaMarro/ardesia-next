// A single active material decoder bounds original-buffer and PDF-worker memory,
// independently of how many pages the user selected or how many views are mounted.
let tail: Promise<unknown> = Promise.resolve();
export function renderMaterialInTurn(job: () => Promise<void>, signal: AbortSignal): Promise<void> {
  const next = tail.catch(() => undefined).then(async () => {if (!signal.aborted) await job();});
  tail = next.catch(() => undefined); return next;
}
export function materialRasterSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw Error('Invalid page geometry');
  const scale=Math.min(2,1600/width,2000/height);
  return {scale,width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
