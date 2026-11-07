export async function prepareOfflineShell(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) throw Error('La copia offline richiede la preview compilata e un browser con supporto offline.');
  const registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'});
  if (registration.active && !registration.installing && !registration.waiting) return checkShell(registration.active);
  const worker = registration.installing ?? registration.waiting;
  if (!worker) throw Error('Preparazione offline non disponibile. Riprova con la rete attiva.');
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => finish(Error('Preparazione offline non completata. Riprova con la rete attiva.')), 30_000);
    const finish = (error?: Error) => {clearTimeout(timer); worker.removeEventListener('statechange', check); error ? reject(error) : resolve();};
    const check = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'installed' && registration.active) finish(Error('Aggiornamento pronto: chiudi le altre schede di Ardesia e riapri prima di preparare la copia offline.'));
      else if (worker.state === 'redundant') finish(Error('Preparazione offline interrotta. La copia precedente è conservata.'));
    };
    worker.addEventListener('statechange', check); check();
  });
  if (!registration.active) throw Error('Copia offline non attivata.');
  await checkShell(registration.active);
}

function checkShell(worker: ServiceWorker): Promise<void> {
  const source = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
  if (!source) return Promise.reject(Error('Interfaccia compilata non riconosciuta.'));
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {channel.port1.close(); reject(Error('Verifica della copia offline non completata.'));}, 30_000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close();
      if (event.data?.available === true) resolve();
      else reject(Error('Chiudi le altre schede di Ardesia e riapri per completare l’aggiornamento offline.'));
    };
    worker.postMessage({kind: 'ardesia-shell-status', entry: new URL(source).pathname}, [channel.port2]);
  });
}
