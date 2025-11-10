// lib/token.ts
import crypto from 'crypto';

/** Create a cryptographically-strong random token (raw, to send to user) */
export function generateRawToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex'); // 64-char hex
}

/** Deterministically hash a token for storage/lookup */
export function sha256Hex(input: string): string {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
