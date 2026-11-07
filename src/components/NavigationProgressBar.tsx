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
    setProgress(35);

    // Progressive increments
    const t1 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 80 ? 68 : prev));
    }, 150);

    const t2 = setTimeout(() => {
      setProgress((prev) => (prev > 0 && prev < 90 ? 84 : prev));
    }, 350);

    // Hard safety timeout: Automatically complete within 850ms so bar can NEVER get stuck on screen
    const safetyTimer = setTimeout(() => {
      finishNavigation();
    }, 850);

    timersRef.current.push(t1, t2, safetyTimer);
  };

  // When pathname or searchParams change, route has finished loading
  useEffect(() => {
    finishNavigation();
    return () => clearAllTimers();
  }, [pathname, searchParams]);

  // Global click & history navigation listener
  useEffect(() => {
    // Intercept history.pushState so programmatic router.push() triggers instant progress bar
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      startNavigation();
      return originalPushState.apply(this, args);
    };

    const handleDocumentClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target || !target.href) return;

      const targetUrl = new URL(target.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      // Only trigger for same-origin internal navigations that actually change page
      if (
        targetUrl.origin === currentUrl.origin &&
        target.target !== '_blank' &&
        !target.hasAttribute('download') &&
        (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search)
      ) {
        startNavigation();
      }
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
      window.history.pushState = originalPushState;
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
          transition: progress === 100 ? 'width 0.15s ease-out, opacity 0.2s ease-in' : 'width 0.3s cubic-bezier(0.1, 0.05, 0.2, 1)',
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
