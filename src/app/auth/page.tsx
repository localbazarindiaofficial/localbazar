'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, cloudSync, db, formatLBUserId } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '@/types';
import '@/styles/auth.css';

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Intercept hardware Back button on Android mobile so it never exits the app, safely returning to '/'
    const onPopState = () => {
      window.location.assign('/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const u = res.user;

      const userUid = u.uid;
      const userEmail = u.email || '';
      const userName = u.displayName || 'Member User';
      const userPhoto = u.photoURL || '';

      const lbId = formatLBUserId(userEmail || userUid || userName);

      // Recover original first joinedDate permanently
      let originalJoinedDate = '';
      try {
        const userDocSnap = await getDoc(doc(db, 'users', lbId));
        if (userDocSnap.exists()) {
          const cloudData = userDocSnap.data() as UserProfile;
          if (cloudData.joinedDate) {
            originalJoinedDate = cloudData.joinedDate;
          }
        }
      } catch {}

      if (!originalJoinedDate && u.metadata?.creationTime) {
        const cDate = new Date(u.metadata.creationTime);
        if (!isNaN(cDate.getTime())) {
          originalJoinedDate = cDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }

      if (!originalJoinedDate) {
        originalJoinedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      const userProfile: UserProfile = {
        id: lbId,
        uid: userUid,
        name: userName,
        email: userEmail,
        photoURL: userPhoto,
        role: 'Member',
        joinedDate: originalJoinedDate,
        verified: true,
      };

      // Keep only active user auth in localStorage, persist full data to Cloud Firestore
      localStorage.setItem('lb_current_user', JSON.stringify(userProfile));
      await cloudSync.saveUser(userProfile);

      router.push('/');
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setErrorMsg(err.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-body">
      <main className="auth-main">
        <div className="auth-card" style={{ position: 'relative' }}>
          {/* Close / Back to Home Button */}
          <Link
            href="/"
            title="Back to Home"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </Link>

          {/* Brand Logo */}
          <div className="card-brand-header">
            <Link href="/" className="auth-brand-logo" title="LocalBazar Home">
              <div className="brand-icon-sm">
                <i className="fa-solid fa-store"></i>
              </div>
              <span>
                Local<span>Bazar</span>
              </span>
            </Link>
          </div>

          {/* Welcome Text */}
          <div className="auth-header-text">
            <h2>Explore your city</h2>
            <p>Sign in to save places, write reviews, and manage your local listings.</p>
          </div>

          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Primary One-Click Social Actions */}
          <div className="auth-actions">
            <button
              type="button"
              className="btn-social-full btn-google"
              id="googleLoginBtn"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: '#2563eb' }}></i>{' '}
                  <span>Connecting with Google...</span>
                </>
              ) : (
                <>
                  <svg className="google-icon" width="20" height="20" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>

          {/* Trust / Safety Badge */}
          <div className="auth-security-note">
            <i className="fa-solid fa-shield-halved"></i>
            <span>Fast, verified and secure sign-in</span>
          </div>

          {/* Footer Agreement */}
          <div className="auth-card-footer">
            <p>
              By continuing, you agree to LocalBazar&apos;s <a href="#">Terms of Service</a> &{' '}
              <a href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
