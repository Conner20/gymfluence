'use client'

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form";
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import Link from "next/link";
import GoogleSignInButton from "../GoogleSignInButton";
import { useRouter } from "next/navigation";
import { toast } from "sonner"



const FormSchema = z.object({
    username: z.string().min(1, "Username is required").max(20),
    email: z.string().min(1, 'Email is required').email('Invalid email'),
    password: z.string().min(1, 'Password is required').min(8, 'Password must have more than 8 characters'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
    location: z.string().min(1, "Location is required"),
}).refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match'
})

const GymCreateProfile = () => {
    const router = useRouter();
    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            username: "",
            email: "",
            password: "",
            confirmPassword: "",
            location: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof FormSchema>) => {
        const response = await fetch('http://localhost:3000/api/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: values.username,
                email: values.email,
                password: values.password,
                location: values.location
            }),
        });

        if (response.ok) {
            router.push('/user-onboarding');
        } else {
            toast("Error", {
                description: "Oops! Something went wrong",
            })
        }
    };

    return (
        <Form {...form}>
            <h1 className="text-3xl text-center mb-4">Sign Up</h1>
            <form onSubmit={form.handleSubmit(onSubmit)} className='w-full'>
                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2">Username</FormLabel>
                                <FormControl className="bg-white">
                                    <Input placeholder="john-doe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2">Email</FormLabel>
                                <FormControl className="bg-white">
                                    <Input placeholder="johndoe@email.com" {...field} />
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
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2">Re-Enter your password</FormLabel>
                                <FormControl className="bg-white">
                                    <Input placeholder="Re-Enter your password" type='password' {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2">City Location</FormLabel>
                                <FormControl className="bg-white">
                                    <Input placeholder="Enter the city you live in" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button className='w-full mt-6' type="submit">Sign Up</Button>
            </form>
            <div className="mx-auto my-4 flex w-full items-center justify-evenly before:mr-4 before:block
            before:h-px before:flex-grow before:bg-stone-400 after:ml-4 after:block after:h-px after:flex-grow
            after:bg-stone-400">
                or
            </div>
            <GoogleSignInButton>Sign Up with Google</GoogleSignInButton>
            <p className="text-center text-sm text-gray-600 mt-2">
                If you already have an account, please&nbsp;
                <Link className='text-green-500 hover:underline' href='/log-in'>Log In</Link>
            </p>
        </Form>

    );
};

export default GymCreateProfile;