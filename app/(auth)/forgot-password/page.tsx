'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const FormSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email'),
});

type BannerState = { type: 'success' | 'error'; message: string } | null;

export default function ForgotPasswordPage() {
    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: { email: '' },
    });
    const [banner, setBanner] = useState<BannerState>(null);

    const onSubmit = async (values: z.infer<typeof FormSchema>) => {
        setBanner(null);
        try {
            const response = await fetch('/api/auth/password-reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            form.reset();
            setBanner({
                type: 'success',
                message: 'If an account exists for that email, a reset link has been sent.',
            });
        } catch (error) {
            setBanner({
                type: 'error',
                message: 'We could not send the reset email. Please try again later.',
            });
        }
    };

    return (
        <div className="bg-slate-200 p-10 rounded-md w-full max-w-md mx-auto">
            <h1 className="text-2xl font-semibold mb-4 text-center">Forgot password</h1>

            {banner && (
                <div
                    role="status"
                    className={`mb-4 rounded-md border px-4 py-2 text-sm ${
                        banner.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                >
                    {banner.message}
                </div>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm">Email</FormLabel>
                                <FormControl className="bg-white">
                                    <Input type="email" placeholder="you@example.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={form.formState.isSubmitting}
                    >
                        {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
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
