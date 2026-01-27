'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
    email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams?.get("token");
    const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
        token ? "verifying" : "idle"
    );
    const [message, setMessage] = useState<string | null>(null);
    const [callbackUrl, setCallbackUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        let mounted = true;
        (async () => {
            try {
                const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
                const data = await res.json().catch(() => ({}));
                if (!mounted) return;
                if (!res.ok || !data?.ok) {
                    setStatus("error");
                    setMessage(data?.error || "This link is invalid or has expired.");
                } else {
                    const dest =
                        typeof data?.callbackUrl === "string" && data.callbackUrl.length > 0
                            ? data.callbackUrl
                            : "/user-onboarding";
                    setCallbackUrl(dest);
                    setStatus("success");
                }
            } catch {
                if (mounted) {
                    setStatus("error");
                    setMessage("Unable to verify this link. Please request a new one.");
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, [token]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: searchParams?.get("email") ?? "" },
    });

    const onSubmit = async (values: FormValues) => {
        setMessage(null);
        try {
            const res = await fetch("/api/auth/verify-email/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!res.ok) throw new Error();
            setStatus("idle");
            setMessage("If this email exists, a verification link has been sent.");
        } catch {
            setMessage("Unable to send verification email. Please try again.");
        }
    };

    return (
        <div className="min-h-screen w-full bg-neutral-50 px-4 py-10 flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-100">
                {status === "verifying" && (
                    <div className="flex flex-col items-center gap-3 text-zinc-600">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p>Verifying your email…</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="space-y-4 text-center">
                        <h1 className="text-3xl font-semibold text-black">Email verified</h1>
                        <p className="text-sm text-zinc-600">
                            Your email has been verified. Continue to onboarding to finish setting up your account.
                        </p>
                        <Link href={callbackUrl ?? "/user-onboarding"}>
                            <Button className="w-full bg-green-700 text-white hover:bg-black">
                                Go to onboarding
                            </Button>
                        </Link>
                    </div>
                )}

                {(status === "idle" || status === "error") && (
                    <div className="space-y-4">
                        <div className="space-y-1 text-center">
                            <h1 className="text-3xl font-semibold text-black">Verify your email</h1>
                            <p className="text-sm text-zinc-600">
                                Enter your email to receive a verification link.
                            </p>
                        </div>

                        {message && (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                                {message}
                            </div>
                        )}

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

                                <Button type="submit" className="w-full bg-green-700 text-white hover:bg-black">
                                    Send verification email
                                </Button>
                            </form>
                        </Form>

                        <div className="text-center text-sm">
                            <Link href="/log-in" className="text-zinc-500 hover:text-zinc-800">
                                ← Back to log in
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen w-full bg-neutral-50 px-4 py-10 flex items-center justify-center">
                    <div className="w-full max-w-sm space-y-6 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-100 text-center text-zinc-600">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        <p>Loading…</p>
                    </div>
                </div>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    );
}
