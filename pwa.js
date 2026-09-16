/**
 * Progressive Web App (PWA) Offline Engine
 * Handles Service Worker registration and native App installation prompt.
 */
(function () {
  'use strict';

  // Automatically purge outdated cache names if present
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        if (name !== 'subway-surf-3d-v6') {
          console.log('[PWA] Purging stale cache:', name);
          caches.delete(name);
        }
      }
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js?v=subway3d_v6')
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope);
          // Check for latest worker version immediately
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
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
