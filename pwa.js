// LocalBazar Central PWA Controller (Service Worker & Multi-Platform App Installer)
(function() {
    'use strict';

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => {
                    console.log('LocalBazar PWA: Service Worker registered successfully.', reg.scope);
                })
                .catch(err => {
                    console.info('LocalBazar PWA: Service Worker notice:', err.message);
                });
        });
    }

    // 2. Custom Multi-Platform Install Banner Controller (Android & iOS)
    let deferredInstallPrompt = null;
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    // Clean up any stale localStorage lock so re-installation works after uninstall
    try {
        if (!isStandalone()) {
            localStorage.removeItem('lb_pwa_installed');
        }
    } catch(e) {}

    async function isAppCurrentlyInstalled() {
        if (isStandalone()) return true;
        if ('getInstalledRelatedApps' in navigator) {
            try {
                const related = await navigator.getInstalledRelatedApps();
                if (related && related.length > 0) return true;
            } catch(e) {}
        }
        return false;
    }

    // A. Android & Desktop Chrome/Edge Native Prompt Listener
    window.addEventListener('beforeinstallprompt', (e) => {
        // Chrome only fires this when the app is NOT installed!
        e.preventDefault();
        deferredInstallPrompt = e;
        try { localStorage.removeItem('lb_pwa_installed'); } catch(e) {}

        const hubRow = document.getElementById('hubInstallAppRow');
        if (hubRow && !isStandalone()) {
            hubRow.style.display = 'flex';
        }

        showPwaInstallBanner();
    });

    // B. Auto-Discovery on page load for visitors without the app
    window.addEventListener('load', async () => {
        if (isStandalone()) {
            removePwaInstallBanner();
            const hubRow = document.getElementById('hubInstallAppRow');
            if (hubRow) hubRow.style.display = 'none';
            return;
        }

        const installed = await isAppCurrentlyInstalled();
        if (installed) {
            removePwaInstallBanner();
            const hubRow = document.getElementById('hubInstallAppRow');
            if (hubRow) hubRow.style.display = 'none';
            return;
        }

        const hubRow = document.getElementById('hubInstallAppRow');
        if (hubRow) hubRow.style.display = 'flex';

        setTimeout(showPwaInstallBanner, 1500);
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        removePwaInstallBanner();
        const hubRow = document.getElementById('hubInstallAppRow');
        if (hubRow) hubRow.style.display = 'none';
        console.log('LocalBazar PWA: App installed successfully.');
        if (typeof showLbToast === 'function') {
            showLbToast('LocalBazar app installed successfully!', 'success');
        }
    });

    async function showPwaInstallBanner() {
        if (document.getElementById('lbPwaInstallBar')) return;
        if (isStandalone()) return;
        if (sessionStorage.getItem('lb_pwa_install_dismissed') === 'true') return;

        if (await isAppCurrentlyInstalled()) return;

        const banner = document.createElement('div');
        banner.id = 'lbPwaInstallBar';
        banner.className = 'lb-pwa-install-bar';
        banner.innerHTML = `
            <div class="lb-pwa-install-content">
                <div class="lb-pwa-icon-box">
                    <img src="icon-512.png" onerror="this.onerror=null; this.src='icons/icon-512.png';" alt="LocalBazar App" class="lb-pwa-thumb">
                </div>
                <div class="lb-pwa-text-group">
                    <strong class="lb-pwa-app-title">Install LocalBazar App</strong>
                    <span class="lb-pwa-app-desc">${isIos ? 'Fast, 1-tap install on your iPhone' : 'Fast, lightweight & instant deals on your home screen'}</span>
                </div>
            </div>
            <div class="lb-pwa-action-group">
                <button type="button" class="btn-pwa-install" id="btnTriggerPwaInstall">
                    <i class="fa-solid fa-download"></i> <span>Install</span>
                </button>
                <button type="button" class="btn-pwa-dismiss" id="btnDismissPwaInstall" title="Not Now">&times;</button>
            </div>
        `;

        document.body.appendChild(banner);

        document.getElementById('btnTriggerPwaInstall')?.addEventListener('click', () => {
            window.installPwaApp();
        });

        document.getElementById('btnDismissPwaInstall')?.addEventListener('click', () => {
            sessionStorage.setItem('lb_pwa_install_dismissed', 'true');
            removePwaInstallBanner();
        });
    }

    function removePwaInstallBanner() {
        const banner = document.getElementById('lbPwaInstallBar');
        if (banner) {
            banner.classList.add('hide');
            setTimeout(() => banner.remove(), 300);
        }
    }

    // Modal guide for iOS users
    function showIosInstallGuide() {
        if (document.getElementById('lbIosInstallModal')) return;
        const modal = document.createElement('div');
        modal.id = 'lbIosInstallModal';
        modal.className = 'lb-ios-install-overlay';
        modal.onclick = function(e) {
            if (e.target === modal) modal.remove();
        };
        modal.innerHTML = `
            <div class="lb-ios-install-card" onclick="event.stopPropagation()">
                <button type="button" class="lb-ios-close-btn" onclick="document.getElementById('lbIosInstallModal')?.remove()">&times;</button>
                <div class="lb-ios-icon-box">
                    <img src="icon-512.png" onerror="this.onerror=null; this.src='icons/icon-512.png';" alt="LocalBazar App">
                </div>
                <h3>Install on iPhone / iPad</h3>
                <p>Install LocalBazar on your home screen for instant access to local shops and deals:</p>
                <div class="lb-ios-steps">
                    <div class="ios-step-row">
                        <div class="ios-step-num">1</div>
                        <div class="ios-step-text">Tap the <strong>Share</strong> button <i class="fa-solid fa-arrow-up-from-bracket" style="color:#2563eb;"></i> at the bottom bar of Safari.</div>
                    </div>
                    <div class="ios-step-row">
                        <div class="ios-step-num">2</div>
                        <div class="ios-step-text">Scroll down and tap <strong>"Add to Home Screen"</strong> <i class="fa-regular fa-square-plus" style="color:#2563eb;"></i>.</div>
                    </div>
                    <div class="ios-step-row">
                        <div class="ios-step-num">3</div>
                        <div class="ios-step-text">Tap <strong>"Add"</strong> at the top right to finish!</div>
                    </div>
                </div>
                <button type="button" class="btn-ios-done" onclick="document.getElementById('lbIosInstallModal')?.remove()">
                    Got It!
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Modal guide for Android / Chrome users
    function showAndroidInstallGuide() {
        if (document.getElementById('lbAndroidInstallModal')) return;
        const modal = document.createElement('div');
        modal.id = 'lbAndroidInstallModal';
        modal.className = 'lb-ios-install-overlay';
        modal.onclick = function(e) {
            if (e.target === modal) modal.remove();
        };
        modal.innerHTML = `
            <div class="lb-ios-install-card" onclick="event.stopPropagation()">
                <button type="button" class="lb-ios-close-btn" onclick="document.getElementById('lbAndroidInstallModal')?.remove()">&times;</button>
                <div class="lb-ios-icon-box">
                    <img src="icon-512.png" onerror="this.onerror=null; this.src='icons/icon-512.png';" alt="LocalBazar App">
                </div>
                <h3>Install LocalBazar App</h3>
                <p>Add LocalBazar to your mobile home screen in 2 quick steps:</p>
                <div class="lb-ios-steps">
                    <div class="ios-step-row">
                        <div class="ios-step-num">1</div>
                        <div class="ios-step-text">Tap the <strong>3 dots (⋮)</strong> at the top-right corner of Chrome.</div>
                    </div>
                    <div class="ios-step-row">
                        <div class="ios-step-num">2</div>
                        <div class="ios-step-text">Tap <strong>"Install app"</strong> (or <strong>"Add to Home screen"</strong>).</div>
                    </div>
                </div>
                <button type="button" class="btn-ios-done" onclick="document.getElementById('lbAndroidInstallModal')?.remove()">
                    Got It!
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Global Universal Install Trigger (Used across all pages & Account Hub)
    window.installPwaApp = async function() {
        // 1. Already running inside standalone installed app
        if (isStandalone()) {
            if (typeof showLbToast === 'function') {
                showLbToast('LocalBazar is already running as an App on your device!', 'info');
            } else {
                alert('LocalBazar is already running as an App on your device!');
            }
            removePwaInstallBanner();
            return;
        }

        // 2. If prompt is in-flight, give it a brief moment
        if (!deferredInstallPrompt) {
            await new Promise(r => setTimeout(r, 600));
        }

        // 3. Android / Desktop Chrome / Edge native 1-click install prompt
        if (deferredInstallPrompt) {
            try {
                deferredInstallPrompt.prompt();
                const { outcome } = await deferredInstallPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('User accepted LocalBazar PWA installation');
                    const hubRow = document.getElementById('hubInstallAppRow');
                    if (hubRow) hubRow.style.display = 'none';
                }
                deferredInstallPrompt = null;
                removePwaInstallBanner();
                return;
            } catch(e) {
                console.warn('Native install prompt failed:', e);
            }
        }

        // 4. iOS iPhone / iPad Safari
        if (isIos) {
            showIosInstallGuide();
            return;
        }

        // 5. Fallback for Android / Desktop Chrome
        showAndroidInstallGuide();
    };
})();
