import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ADMIN_COOKIE_NAME, createAdminToken, verifyAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const DEFAULT_ADMIN_EMAIL = 'localbazar@adminmanaspan.com';
const ADMIN_AUTH_SALT = 'lb_admin_auth_salt_9876';
const DEFAULT_ADMIN_PWD_HASH = '4e0d268d927e16d587c63f68290e711004538d0c769325991f0dcef7392145cb';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
    const token = cookie?.value;
    const result = verifyAdminToken(token);

    if (result.valid) {
      return NextResponse.json({ authenticated: true, email: result.email });
    }
    return NextResponse.json({ authenticated: false });
  } catch (err) {
    return NextResponse.json({ authenticated: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'login';

    if (action === 'logout') {
      const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    if (action === 'login') {
      const email = String(body?.email || '').trim().toLowerCase();
      const password = String(body?.password || '');

      if (!email || !password) {
        return NextResponse.json({ success: false, error: 'Please enter both Admin ID and Password.' }, { status: 400 });
      }

      // 1. Fetch live admin credentials from Firestore
      let expectedEmail = DEFAULT_ADMIN_EMAIL.toLowerCase();
      let expectedHash = DEFAULT_ADMIN_PWD_HASH;

      try {
        const snap = await getDoc(doc(db, 'settings', 'admin_security'));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.email) expectedEmail = String(data.email).trim().toLowerCase();
          if (data?.pwdHash) expectedHash = String(data.pwdHash).trim();
        }
      } catch (err) {
        console.warn('Could not read admin_security from Firestore, using default:', err);
      }

      // 2. Compute SHA-256 of entered password on the server (with salt & fallback)
      const enteredSaltedHash = crypto.createHash('sha256').update(password + ADMIN_AUTH_SALT).digest('hex');
      const enteredPlainHash = crypto.createHash('sha256').update(password).digest('hex');

      const isEmailValid = email === expectedEmail;
      const isPasswordValid = enteredSaltedHash === expectedHash || enteredPlainHash === expectedHash;

      if (isEmailValid && isPasswordValid) {
        // 3. Generate signed HMAC-SHA256 session token
        const token = createAdminToken(expectedEmail);

        const response = NextResponse.json({
          success: true,
          email: expectedEmail,
          message: 'Admin authorization granted',
        });

        // 4. Set HttpOnly, Secure, SameSite=Strict cookie
        response.cookies.set({
          name: ADMIN_COOKIE_NAME,
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 24 * 60 * 60, // 24 hours
        });

        return response;
      }

      return NextResponse.json(
        { success: false, error: 'Invalid Admin ID or Secret Password.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Admin Auth API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server authorization error' }, { status: 500 });
  }
}
