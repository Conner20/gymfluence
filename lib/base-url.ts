/**
 * Resolve the best base URL to use when creating absolute links inside emails.
 * Prefers NEXT_PUBLIC_APP_URL, then NEXTAUTH_URL, then the deployed Vercel URL,
 * and finally falls back to localhost in development.
 */
export function getBaseUrl() {
    const explicit =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.NEXTAUTH_URL?.trim() ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

    if (explicit) {
        return explicit.replace(/\/$/, '');
    }

    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
    }

    return '';
}
