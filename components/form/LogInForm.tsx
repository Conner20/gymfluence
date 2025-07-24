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
import { ChevronsUp } from "lucide-react";
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
        if(logInData?.error) {
            toast("Error", {
                description: "Oops! Something went wrong",
            })
        } else {
            router.refresh();
            router.push('/admin')
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

// <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-start">
        //     {/* Logo */}
        //     <div className="mt-24 mb-8 text-5xl font-bold select-none text-center">
        //         <span className="text-green-700">gymfluence</span>
        //     </div>
        //     {/* Card */}
        //     <div className="bg-white px-12 py-10 rounded-xl shadow-md w-full max-w-md flex flex-col items-center">
        //         <h1 className="text-4xl font-normal mb-7 text-center text-black">log in</h1>
        //         <form className="w-full flex flex-col gap-4">
        //             {/* Email */}
        //             <label className="text-left text-base font-normal text-black">
        //                 Email
        //                 <input
        //                     type="email"
        //                     className="w-full mt-1 mb-2 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-700 transition text-black"
        //                 />
        //             </label>
        //             {/* Password */}
        //             <label className="text-left text-base font-normal text-black">
        //                 Password
        //                 <input
        //                     type="password"
        //                     className="w-full mt-1 mb-2 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-700 transition text-black"
        //                 />
        //             </label>
        //             {/* Create Account Button */}
        //             <button
        //                 type="submit"
        //                 className="w-full bg-green-700 text-white py-2 rounded-md font-normal text-base hover:bg-green-800 transition mb-1"
        //             >
        //                 Create Account
        //             </button>
        //         </form>
        //         {/* Log in Button */}
        //         <Link
        //             href="/log-in"
        //             className="w-full border border-gray-400 text-green-700 text-base rounded-md py-2 mt-2 text-center hover:bg-gray-100 transition"
        //         >
        //             Log in
        //         </Link>
        //     </div>
        // </div>