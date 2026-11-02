// Background update discovery; replace the app only at a fresh opening before interaction.
export function createUpdateManager({serviceWorker, doc, win, beforeReload, reload, onError = () => {}}) {
  let registration = null;
  let interacted = false;
  let activating = false;
  let reloading = false;
  let checking = null;
  const watched = new WeakSet();
  const markInteracted = () => { interacted = true; };

  function activateWhenSafe() {
    if (!registration?.waiting || !serviceWorker.controller || doc.hidden || interacted || activating) return false;
    try {
      // Do not discard in-memory changes if storage could not be written.
      if (beforeReload() === false) return false;
      activating = true;
      registration.waiting.postMessage('activate');
      return true;
    } catch (error) {
      activating = false;
      onError(error);
      return false;
    }
  }

  function watchInstalling() {
    const worker = registration?.installing;
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') activateWhenSafe();
    });
    if (worker.state === 'installed') activateWhenSafe();
  }

  function onControllerChange() {
    // First-time SW installation or an update activated by another tab must not reload this session.
    if (!activating || reloading) return;
    if (beforeReload() === false) return;
    reloading = true;
    reload();
  }

  async function check() {
    if (!registration) return false;
    if (checking) return checking;
    checking = (async () => {
      try {
        await registration.update();
        watchInstalling();
        activateWhenSafe();
        return true;
      } catch (error) {
        onError(error);
        return false;
      }
    })().finally(() => { checking = null; });
    return checking;
  }

  function onReopen() {
    interacted = false;
    activateWhenSafe();
    void check();
  }

  async function start() {
    if (!serviceWorker) return null;
    for (const type of ['pointerdown', 'keydown', 'input']) {
      doc.addEventListener(type, markInteracted, { capture: true, passive: true });
    }
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) onReopen(); });
    win.addEventListener('pageshow', event => { if (event.persisted) onReopen(); });
    serviceWorker.addEventListener('controllerchange', onControllerChange);
    try {
      registration = await serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      registration.addEventListener('updatefound', watchInstalling);
      watchInstalling();
      activateWhenSafe();
      void check();
      return registration;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  return { start, check };
}
