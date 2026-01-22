'use client'

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form";
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import Link from "next/link";
import GoogleSignInButton from "../GoogleSignInButton";
import { signIn } from 'next-auth/react'
import { useRouter } from "next/navigation";
import { toast } from "sonner"

const FormSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email'),
    password: z.string().min(1, 'Password is required').min(8, 'Password must have more than 8 characters')
})

const inputClass =
    "bg-white text-black border border-zinc-200 placeholder:text-zinc-500 focus-visible:border-black focus-visible:ring-black/20 dark:bg-white dark:text-black dark:border-zinc-200 dark:placeholder:text-zinc-500 dark:focus-visible:border-black dark:focus-visible:ring-black/20";

const LogInForm = () => {
    const router = useRouter();
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
            toast("Error", { description: "Oops! Something went wrong" })
        } else {
            router.refresh();
            router.push('/home')
        }
    }

    return (
        <Form {...form}>
            <h1 className="text-3xl text-center mb-4 text-black dark:text-black">Log In</h1>
            <form onSubmit={form.handleSubmit(onSubmit)} className='w-full'>
                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black dark:text-black">Email</FormLabel>
                                <FormControl className="bg-white dark:bg-white">
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
                                    <FormLabel className="mb-2 text-black dark:text-black">Password</FormLabel>
                                    <Link href="/forgot-password" className="text-xs text-green-600 hover:underline dark:text-green-600">
                                        Forgot password?
                                    </Link>
                                </div>
                                <FormControl className="bg-white dark:bg-white">
                                    <Input placeholder="Enter your password" type='password' {...field} className={inputClass} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button className='w-full mt-6 bg-green-700 text-white hover:bg-black dark:bg-green-700 dark:text-white dark:hover:bg-black' type="submit">Log In</Button>
            </form>

            <div className="mx-auto my-4 flex w-full items-center justify-evenly before:mr-4 before:block
        before:h-px before:flex-grow before:bg-stone-400 after:ml-4 after:block after:h-px after:flex-grow
        after:bg-stone-400 dark:before:bg-stone-400 dark:after:bg-stone-400 text-black">
                or
            </div>

            <GoogleSignInButton callbackUrl="/home" className="w-full bg-white text-black border border-zinc-200 hover:bg-zinc-50 dark:bg-white dark:text-black dark:hover:bg-zinc-50">
                Log In with Google
            </GoogleSignInButton>

            <p className="text-center text-sm text-gray-600 mt-2 dark:text-gray-600">
                If you don&apos;t have an account, please&nbsp;
                <Link className='text-green-500 hover:underline dark:text-green-500' href='/sign-up'>Sign Up</Link>
            </p>
        </Form>
    );
};

export default LogInForm;
