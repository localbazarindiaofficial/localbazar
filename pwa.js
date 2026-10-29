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

    function isAppAlreadyInstalled() {
        // A. Already running as installed standalone PWA app
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            return true;
        }
        // B. Recorded in local storage that this device/browser already completed installation
        if (localStorage.getItem('lb_pwa_installed') === 'true') {
            return true;
        }
        return false;
    }

    // If currently running in standalone mode, permanently remember install state & sync UI
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
        try { localStorage.setItem('lb_pwa_installed', 'true'); } catch (e) {}
    }

    // A. Android & Desktop Chrome/Edge Native Prompt Listener
    window.addEventListener('beforeinstallprompt', (e) => {
        if (isAppAlreadyInstalled()) return;
        e.preventDefault();
        deferredInstallPrompt = e;
        showPwaInstallBanner();
    });

    // B. Auto-Discovery on page load for visitors without the app
    window.addEventListener('load', () => {
        // Sync account hub row if already installed
        if (isAppAlreadyInstalled()) {
            const hubRow = document.getElementById('hubInstallAppRow');
            if (hubRow) hubRow.style.display = 'none';
            return;
        }
        setTimeout(showPwaInstallBanner, 1500);
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        try { localStorage.setItem('lb_pwa_installed', 'true'); } catch (e) {}
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
        if (isAppAlreadyInstalled()) return;
        if (sessionStorage.getItem('lb_pwa_install_dismissed') === 'true') return;

        // Check Chrome's getInstalledRelatedApps API if supported
        if ('getInstalledRelatedApps' in navigator) {
            try {
                const related = await navigator.getInstalledRelatedApps();
                if (related && related.length > 0) {
                    try { localStorage.setItem('lb_pwa_installed', 'true'); } catch (e) {}
                    return;
                }
            } catch (e) {}
        }

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
                    <img src="icon-192.png" onerror="this.onerror=null; this.src='icons/icon-192.png';" alt="LocalBazar App">
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
                    <img src="icon-192.png" onerror="this.onerror=null; this.src='icons/icon-192.png';" alt="LocalBazar App">
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
        // 1. Already running as standalone app or previously installed
        if (isAppAlreadyInstalled()) {
            if (typeof showLbToast === 'function') {
                showLbToast('LocalBazar is already installed on your device!', 'info');
            } else {
                alert('LocalBazar is already installed and running as an App on your device!');
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
                    try { localStorage.setItem('lb_pwa_installed', 'true'); } catch (e) {}
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
