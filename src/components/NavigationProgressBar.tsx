'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // When route changes, complete the progress bar
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Global click & history navigation listener to trigger instant 0ms visual feedback
  useEffect(() => {
    // Intercept history.pushState so programmatic router.push() triggers instant progress bar
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      setIsNavigating(true);
      setProgress(35);
      setTimeout(() => setProgress((p) => (p > 0 && p < 80 ? 72 : p)), 150);
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
        setIsNavigating(true);
        setProgress(28);

        // Progressive bump to show active loading
        setTimeout(() => setProgress((p) => (p > 0 && p < 80 ? 68 : p)), 180);
        setTimeout(() => setProgress((p) => (p > 0 && p < 90 ? 88 : p)), 450);
      }
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
      window.history.pushState = originalPushState;
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
          transition: progress === 100 ? 'width 0.15s ease-out, opacity 0.2s ease-in' : 'width 0.35s cubic-bezier(0.1, 0.05, 0.2, 1)',
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
