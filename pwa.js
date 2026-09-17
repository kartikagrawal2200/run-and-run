/**
 * Subway Surf 3D - Cache Management & App Install Engine
 * Automatically unregisters stale workers and cleans caches to ensure 100% fresh assets.
 */
(function () {
  'use strict';

  // Purge ALL browser caches completely to prevent stale scripts/styles
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        console.log('[PWA] Purging browser cache:', name);
        caches.delete(name);
      }
    }).catch(() => {});
  }

  // Unregister all existing service workers in development so fresh code loads instantly
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        console.log('[PWA] Unregistering service worker:', registration.scope);
        registration.unregister();
      }
    }).catch(() => {});
  }

  let deferredPrompt = null;
  const installBtn = document.getElementById('installAppBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.classList.remove('hidden');
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
          alert("To install on iPhone/iPad:\n1. Tap the Share button (⎋) in Safari.\n2. Select 'Add to Home Screen' (⊞).\n3. Play offline anytime without internet!");
        } else {
          alert("To install, tap your browser's menu (⋮) and choose 'Install App' or 'Add to Home screen'.");
        }
        return;
      }

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) {
      installBtn.classList.add('hidden');
    }
    console.log('[PWA] App installed successfully');
  });
})();
