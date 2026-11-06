'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    __pwaDeferredPrompt?: any;
    __triggerPwaInstall?: () => void;
    __isPwaInstalled?: boolean;
  }
}

export default function PwaInstallManager() {
  const pathname = usePathname();
  const isAdminRoute = Boolean(
    pathname && (
      pathname.startsWith('/admin') ||
      pathname.startsWith('/manas-pan-login-admin')
    )
  );

  const [isInstalled, setIsInstalled] = useState(true); // default true to avoid flash on SSR
  const [showBanner, setShowBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const reShowTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide and cancel timers whenever user enters admin panel
  useEffect(() => {
    if (isAdminRoute) {
      setShowBanner(false);
      setShowIosGuide(false);
      if (reShowTimerRef.current) {
        clearTimeout(reShowTimerRef.current);
        reShowTimerRef.current = null;
      }
    }
  }, [isAdminRoute]);

  // Helper: Detect if currently running in standalone (installed app) mode
  const checkIsStandalone = (): boolean => {
    if (typeof window === 'undefined') return false;
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as any).standalone === true;
    const isAndroidApp = document.referrer.includes('android-app://');
    return isStandaloneMedia || isIosStandalone || isAndroidApp;
  };

  // Helper: Get timestamp until which banner is dismissed
  const getDismissedUntil = (): number => {
    try {
      const fromLocal = parseInt(localStorage.getItem('lb_pwa_dismissed_until') || '0', 10);
      const fromSession = parseInt(sessionStorage.getItem('lb_pwa_dismissed_until') || '0', 10);
      return Math.max(fromLocal, fromSession, 0);
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initial Standalone Check
    const standalone = checkIsStandalone();
    if (standalone) {
      setIsInstalled(true);
      window.__isPwaInstalled = true;
      localStorage.setItem('lb_pwa_installed', 'true');
      window.dispatchEvent(new CustomEvent('lb_pwa_status', { detail: { isInstalled: true } }));
      return;
    }

    // 2. Check if browser can confirm related apps installed
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
        if (relatedApps && relatedApps.length > 0) {
          setIsInstalled(true);
          window.__isPwaInstalled = true;
          localStorage.setItem('lb_pwa_installed', 'true');
          window.dispatchEvent(new CustomEvent('lb_pwa_status', { detail: { isInstalled: true } }));
          return;
        }
      }).catch(() => {});
    }

    // 3. Check previously recorded install status
    const storedInstalled = localStorage.getItem('lb_pwa_installed') === 'true';
    if (storedInstalled && standalone) {
      setIsInstalled(true);
      window.__isPwaInstalled = true;
      return;
    }

    // If not running in standalone, treat as not installed initially
    setIsInstalled(false);
    window.__isPwaInstalled = false;
    window.dispatchEvent(new CustomEvent('lb_pwa_status', { detail: { isInstalled: false } }));

    // 4. Check 1-minute dismissal timer (Strictly excluded on admin routes)
    const scheduleNextShow = (delayMs: number = 2000) => {
      if (reShowTimerRef.current) clearTimeout(reShowTimerRef.current);
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (currentPath.startsWith('/admin') || currentPath.startsWith('/manas-pan-login-admin')) {
        return;
      }
      reShowTimerRef.current = setTimeout(() => {
        const pathNow = typeof window !== 'undefined' ? window.location.pathname : '';
        if (pathNow.startsWith('/admin') || pathNow.startsWith('/manas-pan-login-admin')) {
          return;
        }
        const until = getDismissedUntil();
        if (Date.now() >= until && !checkIsStandalone() && localStorage.getItem('lb_pwa_installed') !== 'true') {
          setShowBanner(true);
        }
      }, delayMs);
    };

    const dismissedUntil = getDismissedUntil();
    const now = Date.now();
    if (dismissedUntil > now) {
      const remainingTime = dismissedUntil - now;
      scheduleNextShow(remainingTime);
    } else {
      // Show popup 2 seconds after page load for smooth entry
      scheduleNextShow(2000);
    }

    // 5. Listen for beforeinstallprompt (Fires only if app is NOT installed)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__pwaDeferredPrompt = e;
      
      // If browser fires this, the app is definitely NOT installed (even if previously flagged)
      localStorage.removeItem('lb_pwa_installed');
      setIsInstalled(false);
      window.__isPwaInstalled = false;
      window.dispatchEvent(new CustomEvent('lb_pwa_status', { detail: { isInstalled: false } }));

      // Check dismissal timer (Strictly disabled on admin routes)
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!currentPath.startsWith('/admin') && !currentPath.startsWith('/manas-pan-login-admin')) {
        const currentDismissedUntil = getDismissedUntil();
        if (Date.now() >= currentDismissedUntil) {
          setShowBanner(true);
        }
      }
    };

    // 6. Listen for appinstalled (When user completes installation)
    const handleAppInstalled = () => {
      localStorage.setItem('lb_pwa_installed', 'true');
      setIsInstalled(true);
      window.__isPwaInstalled = true;
      setShowBanner(false);
      setShowIosGuide(false);
      window.__pwaDeferredPrompt = null;
      if (reShowTimerRef.current) clearTimeout(reShowTimerRef.current);
      window.dispatchEvent(new CustomEvent('lb_pwa_status', { detail: { isInstalled: true } }));
    };

    // 7. Listen for display-mode change
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        handleAppInstalled();
      } else {
        // Exited standalone mode
        setIsInstalled(false);
        window.__isPwaInstalled = false;
        scheduleNextShow(2000);
        window.dispatchEvent(new CustomEvent('lb_pwa_status', { detail: { isInstalled: false } }));
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    // 8. Global Install Trigger (Callable from Settings or any button)
    window.__triggerPwaInstall = () => {
      triggerInstall();
    };

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      if (reShowTimerRef.current) clearTimeout(reShowTimerRef.current);
    };
  }, []);

  // Handle Install Click
  const triggerInstall = async () => {
    if (window.__pwaDeferredPrompt) {
      try {
        const promptEvent = window.__pwaDeferredPrompt;
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          localStorage.setItem('lb_pwa_installed', 'true');
          setIsInstalled(true);
          window.__isPwaInstalled = true;
          setShowBanner(false);
          window.dispatchEvent(new CustomEvent('lb_pwa_status', { detail: { isInstalled: true } }));
        }
        window.__pwaDeferredPrompt = null;
      } catch (err) {
        setShowIosGuide(true);
      }
    } else {
      // Fallback for iOS Safari or desktop without direct prompt
      setShowIosGuide(true);
    }
  };

  // Handle Dismiss (Reappear every 1 minute = 60,000ms)
  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowBanner(false);
    // Set 1 minute cooldown (60,000ms) in both localStorage & sessionStorage
    const nextShowTime = Date.now() + 60000;
    try {
      localStorage.setItem('lb_pwa_dismissed_until', String(nextShowTime));
      sessionStorage.setItem('lb_pwa_dismissed_until', String(nextShowTime));
    } catch {}

    if (reShowTimerRef.current) clearTimeout(reShowTimerRef.current);
    reShowTimerRef.current = setTimeout(() => {
      const pathNow = typeof window !== 'undefined' ? window.location.pathname : '';
      if (pathNow.startsWith('/admin') || pathNow.startsWith('/manas-pan-login-admin')) {
        return;
      }
      // Only re-show if still not installed and not in standalone
      if (!checkIsStandalone() && localStorage.getItem('lb_pwa_installed') !== 'true') {
        setShowBanner(true);
      }
    }, 60000);
  };

  // If user is inside Admin panel or if app is installed / running standalone, render nothing
  if (isAdminRoute || isInstalled) {
    return null;
  }

  return (
    <>
      {/* 1. Bottom 1-Click Install Banner */}
      {showBanner && (
        <div className="lb-pwa-install-bar">
          <div className="lb-pwa-install-content">
            <div className="lb-pwa-icon-box">
              <img src="/app-logo-hd-192.png" alt="LocalBazar" className="lb-pwa-thumb" />
            </div>
            <div className="lb-pwa-text-group">
              <div className="lb-pwa-app-title">Install LocalBazar App</div>
              <div className="lb-pwa-app-desc">Fast, offline access & 1-tap browse</div>
            </div>
          </div>
          <div className="lb-pwa-action-group">
            <button type="button" className="btn-pwa-install" onClick={triggerInstall}>
              <i className="fa-solid fa-download"></i>
              <span>Install</span>
            </button>
            <button
              type="button"
              className="btn-pwa-dismiss"
              onClick={handleDismiss}
              aria-label="Close"
              title="Dismiss (Reappears in 1 min)"
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '1.1rem', pointerEvents: 'none' }}></i>
            </button>
          </div>
        </div>
      )}

      {/* 2. iOS / Browser Manual Install Guide Modal */}
      {showIosGuide && (
        <div className="lb-ios-install-overlay" onClick={() => setShowIosGuide(false)}>
          <div className="lb-ios-install-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lb-ios-close-btn" onClick={() => setShowIosGuide(false)}>&times;</button>
            <div className="lb-ios-icon-box">
              <img src="/app-logo-hd-192.png" alt="LocalBazar" />
            </div>
            <h3>Install LocalBazar App</h3>
            <p>Add LocalBazar to your home screen for quick 1-tap access and real-time updates.</p>
            <div className="lb-ios-steps">
              <div className="ios-step-row">
                <div className="ios-step-num">1</div>
                <div className="ios-step-text">Tap the <strong>Share</strong> button <i className="fa-solid fa-arrow-up-from-bracket"></i> in Safari or browser menu <i className="fa-solid fa-ellipsis-vertical"></i>.</div>
              </div>
              <div className="ios-step-row">
                <div className="ios-step-num">2</div>
                <div className="ios-step-text">Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install app&quot;</strong>.</div>
              </div>
              <div className="ios-step-row">
                <div className="ios-step-num">3</div>
                <div className="ios-step-text">Tap <strong>Add / Install</strong> to confirm. The LocalBazar app icon will appear on your screen!</div>
              </div>
            </div>
            <button type="button" className="btn-ios-done" onClick={() => setShowIosGuide(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
