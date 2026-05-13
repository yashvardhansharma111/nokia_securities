/**
 * In-memory OTP store for email-based flows (e.g. forgot-password).
 * Keyed by email address. Pinned to globalThis so Next.js hot-reloads don't clear entries.
 */

interface OtpEntry {
  code: string;
  expiresAt: number;
  verified: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __emailOtpCache: Map<string, OtpEntry> | undefined;
}

const cache: Map<string, OtpEntry> =
  globalThis.__emailOtpCache ?? (globalThis.__emailOtpCache = new Map());

export function setEmailOtp(email: string, code: string, ttlMs = 10 * 60 * 1000): void {
  cache.set(email.toLowerCase(), { code, expiresAt: Date.now() + ttlMs, verified: false });
}

export function getEmailOtp(email: string): OtpEntry | undefined {
  return cache.get(email.toLowerCase());
}

export function verifyEmailOtp(email: string, code: string): boolean {
  const entry = cache.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    cache.delete(email.toLowerCase());
    return false;
  }
  return entry.code === code;
}

export function deleteEmailOtp(email: string): void {
  cache.delete(email.toLowerCase());
}
