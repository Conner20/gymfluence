'use client'

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form";
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import Link from "next/link";
import { signIn } from 'next-auth/react'
import { useRouter } from "next/navigation";
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"

const FormSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email'),
    password: z.string().min(1, 'Password is required').min(8, 'Password must have more than 8 characters')
})

const inputClass =
    "bg-white text-black border border-zinc-200 placeholder:text-zinc-500 focus-visible:border-black focus-visible:ring-black/20";

const LogInForm = () => {
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showResendPrompt, setShowResendPrompt] = useState(false);
    const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
    });

    const onSubmit = async (values: z.infer<typeof FormSchema>) => {
        setShowResendPrompt(false);
        setResendStatus("idle");

        const logInData = await signIn('credentials', {
            email: values.email,
            password: values.password,
            redirect: false,
        });
        if (logInData?.error) {
            if (logInData.error === "EMAIL_NOT_VERIFIED") {
                setErrorMessage("Please verify your email before logging in.");
                setShowResendPrompt(true);
            } else {
                setErrorMessage("Oops! Something went wrong. Please check your credentials and try again.");
            }
        } else {
            setErrorMessage(null);
            setShowResendPrompt(false);
            router.refresh();
            router.push('/home')
        }
    }

    const handleResendVerification = async () => {
        const email = form.getValues("email");
        if (!email) return;
        setResendStatus("sending");
        try {
            await fetch("/api/auth/verify-email/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            setResendStatus("sent");
        } catch {
            setResendStatus("idle");
        }
    };

    return (
        <Form {...form}>
            <h1 className="text-3xl text-center mb-4 text-black">Log In</h1>
            <form onSubmit={form.handleSubmit(onSubmit)} className='w-full'>
                {errorMessage && (
                    <Alert className="mb-4 border border-red-200 bg-red-50 text-red-900 shadow-none">
                        <AlertTitle className="text-red-900">Unable to log in</AlertTitle>
                        <AlertDescription className="text-red-800">
                            {errorMessage}
                        </AlertDescription>
                        {showResendPrompt && (
                            <div className="mt-3 space-y-2 text-left">
                                <p className="text-sm text-zinc-600">
                                    Didn&apos;t get the email?
                                </p>
                                <Button
                                    type="button"
                                    className="w-full bg-red-600 text-white hover:bg-red-700"
                                    onClick={handleResendVerification}
                                    disabled={resendStatus === "sending"}
                                >
                                    {resendStatus === "sending" ? "Sending…" : "Resend verification email"}
                                </Button>
                                {resendStatus === "sent" && (
                                    <p className="text-xs text-green-600">Verification email sent.</p>
                                )}
                            </div>
                        )}
                    </Alert>
                )}
                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black">Email</FormLabel>
                                <FormControl className="bg-white">
                                    <Input placeholder="Enter your email" {...field} className={inputClass} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel className="mb-2 text-black">Password</FormLabel>
                                    <Link href="/forgot-password" className="text-xs text-green-600 hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>
                                <FormControl className="bg-white">
                                    <Input placeholder="Enter your password" type='password' {...field} className={inputClass} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button className='w-full mt-6 bg-green-700 text-white hover:bg-black' type="submit">Log In</Button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-2 text-gray-600">
                If you don&apos;t have an account, please&nbsp;
                <Link className='text-green-600 hover:underline' href='/sign-up'>Sign Up</Link>
            </p>
        </Form>
    );
};

export default LogInForm;
