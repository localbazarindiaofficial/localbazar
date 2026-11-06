import crypto from 'crypto';

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'localbazar_super_admin_hmac_secret_2026_x89a1';
export const ADMIN_COOKIE_NAME = 'lb_admin_session';

export function createAdminToken(email: string): string {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = JSON.stringify({ email: email.toLowerCase(), exp: expiresAt });
  const payloadB64 = Buffer.from(payload).toString('base64url');

  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(payloadB64);
  const signature = hmac.digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyAdminToken(token: string | undefined | null): { valid: boolean; email?: string } {
  if (!token || typeof token !== 'string') return { valid: false };

  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return { valid: false };

  try {
    const hmac = crypto.createHmac('sha256', SESSION_SECRET);
    hmac.update(payloadB64);
    const expectedSig = hmac.digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false };
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    if (!payload || typeof payload.exp !== 'number') return { valid: false };
    if (Date.now() > payload.exp) return { valid: false };

    return { valid: true, email: payload.email };
  } catch {
    return { valid: false };
  }
}
