'use client';

import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

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
            form.reset();
        } catch (error) {
            console.error(error);
            setStatus('idle');
            setErrorMessage('Unable to send a reset link right now. Please try again in a moment.');
            toast('Done', { description: 'If an account exists, a reset link has been sent.' });
        }
    };

    return (
        <div className="min-h-screen w-full bg-neutral-50 px-4 py-10 flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-100">
                <div className="space-y-1 text-center">
                    <h1 className="text-3xl font-semibold text-black">Forgot password</h1>
                    <p className="text-sm text-zinc-500">
                        Enter the email linked to your account and we&apos;ll send a reset link.
                    </p>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-zinc-700">Email</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="you@example.com"
                                            className="bg-white text-black border border-zinc-200 placeholder:text-zinc-500 focus-visible:border-black focus-visible:ring-black/20"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

                        {status === 'sent' && (
                            <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-600">
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                                Reset link sent
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-green-700 text-white hover:bg-black"
                        >
                            {status === 'loading' ? 'Sending…' : 'Send reset link'}
                        </Button>
                    </form>
                </Form>

                <div className="text-center">
                    <Link
                        href="/log-in"
                        className="text-sm text-zinc-500 transition hover:text-zinc-800"
                    >
                        ← Back to log in
                    </Link>
                </div>
            </div>
        </div>
    );
}
