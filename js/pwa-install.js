/**
 * PWA Installation and Service Worker Manager
 * Handles install prompts for Android/Chrome/Edge and step-by-step guidance for iOS/iPad Safari.
 */

export class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  init() {
    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.setupNetworkMonitor();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);

            // Listen for service worker updates
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              newWorker?.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.notifyUpdateAvailable();
                }
              });
            });
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  setupInstallPrompt() {
    const installBtns = document.querySelectorAll('.btn-install-pwa');

    // If already in standalone mode, hide install buttons
    if (this.isStandalone) {
      installBtns.forEach(btn => btn.classList.add('d-none'));
      return;
    }

    // Capture Chrome/Android/Edge beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      installBtns.forEach(btn => btn.classList.remove('d-none'));
    });

    // App installed event
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      installBtns.forEach(btn => btn.classList.add('d-none'));
      console.log('[PWA] App successfully installed!');
    });

    // Click handler for install buttons
    installBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.triggerInstall();
      });
    });

    // If iOS Safari, make install button visible and open iOS modal
    if (this.isIOS && !this.isStandalone) {
      installBtns.forEach(btn => btn.classList.remove('d-none'));
    }
  }

  async triggerInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('[PWA] User accepted installation prompt');
      } else {
        console.log('[PWA] User dismissed installation prompt');
      }
      this.deferredPrompt = null;
    } else if (this.isIOS) {
      // Show iOS modal guide
      const iosModalEl = document.getElementById('iosInstallModal');
      if (iosModalEl && window.bootstrap) {
        const modal = new window.bootstrap.Modal(iosModalEl);
        modal.show();
      }
    } else {
      // General prompt or alert
      alert('To install this app on your device, use your browser menu and choose "Add to Home Screen" or "Install App".');
    }
  }

  setupNetworkMonitor() {
    const offlineBanner = document.getElementById('offlineBanner');
    const updateNetworkStatus = () => {
      if (!navigator.onLine) {
        offlineBanner?.classList.remove('d-none');
      } else {
        offlineBanner?.classList.add('d-none');
      }
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
  }

  notifyUpdateAvailable() {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-primary border-0 show mb-2 shadow';
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi bi-arrow-repeat me-1"></i> A new version of Soniox STT is ready.
          <button id="reloadAppBtn" class="btn btn-sm btn-light ms-2">Update</button>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;
    container.appendChild(toastEl);
    document.getElementById('reloadAppBtn')?.addEventListener('click', () => {
      window.location.reload();
    });
  }
}
