'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Managed timer references so no delayed timer can ever run after completion
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const isNavigatingRef = useRef(false);
  isNavigatingRef.current = isNavigating;

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const finishNavigation = () => {
    clearAllTimers();
    setProgress(100);
    const fadeTimer = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 220);
    timersRef.current.push(fadeTimer);
  };

  const startNavigation = () => {
    clearAllTimers();
    setIsNavigating(true);
    setProgress(28);

    // Progressive increments: realistic visual feedback while page chunks fetch
    const t1 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 60 ? 58 : prev));
    }, 120);

    const t2 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 80 ? 76 : prev));
    }, 280);

    const t3 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 90 ? 84 : prev));
    }, 550);

    // Continuous subtle trickle: creeps forward every 400ms so user knows it's actively working
    const tTrickle1 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 92 ? 89 : prev));
    }, 950);

    const tTrickle2 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 95 ? 93 : prev));
    }, 1500);

    const tTrickle3 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 97 ? 95 : prev));
    }, 2200);

    // Generous safety timeout: Dismiss after 3800ms if navigation completed or aborted
    const safetyTimer = setTimeout(() => {
      finishNavigation();
    }, 3800);

    timersRef.current.push(t1, t2, t3, tTrickle1, tTrickle2, tTrickle3, safetyTimer);
  };

  // When pathname or searchParams change (Route transition reached DOM)
  useEffect(() => {
    // If navigation was already active (user clicked link or search):
    // Advance to 82% to indicate page DOM reached, but DO NOT instantly vanish!
    // Give time for live Firestore data to settle or wait for explicit lb:finish-navigation.
    if (isNavigatingRef.current) {
      setProgress((prev) => (prev < 82 ? 82 : prev));
      const routeHoldTimer = setTimeout(() => {
        finishNavigation();
      }, 1200);
      timersRef.current.push(routeHoldTimer);
    } else {
      // Direct browser back/forward or initial transition
      clearAllTimers();
      setIsNavigating(true);
      setProgress(40);
      const t = setTimeout(() => setProgress(85), 100);
      const finishTimer = setTimeout(() => finishNavigation(), 450);
      timersRef.current.push(t, finishTimer);
    }
  }, [pathname, searchParams]);

  // Safe, non-blocking click & custom trigger listeners
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target || !target.href) return;

      try {
        const targetUrl = new URL(target.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        // Only trigger for same-origin internal navigations that actually change page
        if (
          targetUrl.origin === currentUrl.origin &&
          target.target !== '_blank' &&
          !target.hasAttribute('download') &&
          (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search)
        ) {
          // Defer startNavigation so it NEVER interrupts Next.js Link dispatch
          setTimeout(() => {
            startNavigation();
          }, 0);
        }
      } catch {}
    };

    const handleCustomStart = () => {
      startNavigation();
    };

    const handleCustomFinish = () => {
      finishNavigation();
    };

    document.addEventListener('click', handleDocumentClick);
    window.addEventListener('lb:start-navigation', handleCustomStart);
    window.addEventListener('lb:finish-navigation', handleCustomFinish);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      window.removeEventListener('lb:start-navigation', handleCustomStart);
      window.removeEventListener('lb:finish-navigation', handleCustomFinish);
      clearAllTimers();
    };
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999999,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #2563eb, #38bdf8, #2563eb)',
          backgroundSize: '200% 100%',
          animation: 'lbProgressGlow 1.2s linear infinite',
          boxShadow: '0 0 10px rgba(37, 99, 235, 0.7), 0 0 5px rgba(56, 189, 248, 0.5)',
          borderRadius: '0 3px 3px 0',
          transition: progress === 100 ? 'width 0.18s ease-out, opacity 0.22s ease-in' : 'width 0.35s cubic-bezier(0.1, 0.05, 0.2, 1)',
          opacity: progress === 100 ? 0 : 1,
        }}
      />
      <style jsx>{`
        @keyframes lbProgressGlow {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
      `}</style>
    </div>
  );
}
