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
        <>
            <div className="bg-slate-200 p-10 rounded-md w-full max-w-md mx-auto">
            <h1 className="text-2xl font-semibold mb-2 text-center">Forgot password</h1>

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
                        <div className="flex justify-center">
                            <div className="sent-indicator flex items-center gap-2 text-green-600 text-sm font-semibold">
                                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                                <span>Sent</span>
                            </div>
                        </div>
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
            <style jsx>{`
            @keyframes sent-pop {
                0% {
                    transform: scale(0.6);
                    opacity: 0;
                }
                60% {
                    transform: scale(1.05);
                    opacity: 1;
                }
                100% {
                    transform: scale(1);
                }
            }

            @keyframes sent-glow {
                0% {
                    filter: drop-shadow(0 0 0 rgba(34, 197, 94, 0.25));
                }
                100% {
                    filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.55));
                }
            }

            .sent-indicator {
                animation: sent-pop 320ms ease-out, sent-glow 1.2s ease-in-out infinite alternate;
            }
            `}</style>
        </>
    );
}
