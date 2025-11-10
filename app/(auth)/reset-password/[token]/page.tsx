'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const { token } = useParams<{ token: string }>();
    const router = useRouter();
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pw.length < 8) return toast('Error', { description: 'Password must be at least 8 characters.' });
        if (pw !== pw2) return toast('Error', { description: 'Passwords do not match.' });

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password: pw }),
            });
            if (!res.ok) throw new Error();
            toast('Password updated', { description: 'You can now log in with your new password.' });
            router.push('/log-in');
        } catch {
            toast('Link invalid or expired', { description: 'Please request a new password reset link.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-200 p-10 rounded-md w-full max-w-md mx-auto">
            <h1 className="text-2xl font-semibold mb-4 text-center">Reset password</h1>
            <form onSubmit={onSubmit} className="space-y-4">
                <label className="text-sm">New password</label>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="********" minLength={8} required />
                <label className="text-sm">Confirm password</label>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="********" minLength={8} required />
                <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Updating…' : 'Update password'}
                </Button>
                <div className="text-center text-sm">
                    <Link href="/log-in" className="text-green-600 hover:underline">Back to log in</Link>
                </div>
            </form>
        </div>
    );
}
