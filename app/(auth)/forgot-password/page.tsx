'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!res.ok) throw new Error();
            toast('Check your email', { description: 'If an account exists, a reset link has been sent.' });
            setEmail('');
        } catch {
            toast('Done', { description: 'If an account exists, a reset link has been sent.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-200 p-10 rounded-md w-full max-w-md mx-auto">
            <h1 className="text-2xl font-semibold mb-4 text-center">Forgot password</h1>
            <form onSubmit={onSubmit} className="space-y-4">
                <label className="text-sm">Email</label>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="bg-white"
                />
                <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Sending…' : 'Send reset link'}
                </Button>
            </form>

            <div className="mt-4">
                <Link href="/log-in">
                    <Button type="button" variant="outline" className="w-full">
                        Back to log in
                    </Button>
                </Link>
            </div>
        </div>
    );
}
