/**
 * Progressive Web App (PWA) Offline Engine
 * Handles Service Worker registration and native App installation prompt.
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope);
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
    console.log('[PWA] App successfully installed locally!');
    if (installBtn) {
      installBtn.classList.add('hidden');
    }
  });

  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    if (installBtn) {
      installBtn.classList.add('hidden');
    }
  }
})();
