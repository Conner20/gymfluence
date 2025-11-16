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
            <h1 className="text-3xl text-center mb-4">Log In</h1>
            <form onSubmit={form.handleSubmit(onSubmit)} className='w-full'>
                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2">Email</FormLabel>
                                <FormControl className="bg-white">
                                    <Input placeholder="Enter your email" {...field} />
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
                                <FormLabel className="mb-2">Password</FormLabel>
                                <FormControl className="bg-white">
                                    <Input placeholder="Enter your password" type='password' {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button className='w-full mt-6' type="submit">Log In</Button>
                <div className="mt-3 text-right">
                    <Link href="/forgot-password" className="text-sm text-green-600 hover:underline">
                        Forgot password?
                    </Link>
                </div>
            </form>

            <div className="mx-auto my-4 flex w-full items-center justify-evenly before:mr-4 before:block
        before:h-px before:flex-grow before:bg-stone-400 after:ml-4 after:block after:h-px after:flex-grow
        after:bg-stone-400">
                or
            </div>

            <GoogleSignInButton>Log In with Google</GoogleSignInButton>

            <p className="text-center text-sm text-gray-600 mt-2">
                If you don&apos;t have an account, please&nbsp;
                <Link className='text-green-500 hover:underline' href='/sign-up'>Sign Up</Link>
            </p>
        </Form>
    );
};

export default LogInForm;
