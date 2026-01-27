'use client';

import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

            setStatus('sent');
            form.reset();
        } catch (error) {
            console.error(error);
            setStatus('idle');
            setErrorMessage('Unable to send a reset link right now. Please try again in a moment.');
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

                        {errorMessage && (
                            <Alert variant="destructive">
                                <AlertTitle>Unable to send email</AlertTitle>
                                <AlertDescription className="text-black">
                                    {errorMessage}
                                </AlertDescription>
                            </Alert>
                        )}

                        {status === 'sent' && (
                            <Alert className="border-green-200 bg-green-50 text-green-800">
                                <AlertTitle>Check your inbox</AlertTitle>
                                <AlertDescription className="text-green-700">
                                    If an account exists for that email, we just sent a reset link.
                                </AlertDescription>
                            </Alert>
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
