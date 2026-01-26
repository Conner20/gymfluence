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
    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
    });

    const onSubmit = async (values: z.infer<typeof FormSchema>) => {
        const logInData = await signIn('credentials', {
            email: values.email,
            password: values.password,
            redirect: false,
        });
        if (logInData?.error) {
            setErrorMessage("Oops! Something went wrong. Please check your credentials and try again.")
        } else {
            setErrorMessage(null);
            router.refresh();
            router.push('/home')
        }
    }

    return (
        <Form {...form}>
            <h1 className="text-3xl text-center mb-4 text-black">Log In</h1>
            <form onSubmit={form.handleSubmit(onSubmit)} className='w-full'>
                {errorMessage && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Unable to log in</AlertTitle>
                        <AlertDescription className="text-black">
                            {errorMessage}
                        </AlertDescription>
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
