'use client';

import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const schema = z.object({
    email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

type SubmitState = 'idle' | 'loading' | 'sent';

export default function ForgotPasswordPage() {
    const [status, setStatus] = useState<SubmitState>('idle');
    const [submittedEmail, setSubmittedEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: '' },
    });

    const onSubmit = async (values: FormValues) => {
        setStatus('loading');
        setErrorMessage(null);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!res.ok) throw new Error('Failed');

            toast('Check your email', {
                description: 'If an account exists, a reset link has been sent.',
            });
            setStatus('sent');
            setSubmittedEmail(values.email.trim());
            form.reset();
        } catch (error) {
            console.error(error);
            setStatus('idle');
            setErrorMessage('Unable to send a reset link right now. Please try again in a moment.');
            toast('Done', { description: 'If an account exists, a reset link has been sent.' });
        }
    };

    return (
        <div className="bg-slate-200 p-10 rounded-md w-full max-w-md mx-auto">
            <h1 className="text-2xl font-semibold mb-2 text-center">Forgot password</h1>
            <p className="text-center text-sm text-slate-600 mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="you@example.com" className="bg-white" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

                    {status === 'sent' && (
                        <p className="text-sm rounded-md bg-white/60 p-3 text-slate-700">
                            We&apos;ve sent an email to <span className="font-semibold">{submittedEmail}</span>. If it
                            doesn&apos;t arrive within a few minutes, check your spam folder or try again.
                        </p>
                    )}

                    <Button type="submit" disabled={status === 'loading'} className="w-full">
                        {status === 'loading' ? 'Sending…' : 'Send reset link'}
                    </Button>
                </form>
            </Form>

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