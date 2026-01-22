'use client';

import { useEffect, useState } from "react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import Link from "next/link";
import GoogleSignInButton from "../GoogleSignInButton";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

const LOCKED_INPUT_CLASS =
    "bg-white text-black border border-zinc-200 placeholder:text-zinc-500 focus-visible:border-black focus-visible:ring-black/20 dark:bg-white dark:text-black dark:border-zinc-200 dark:placeholder:text-zinc-500 dark:focus-visible:border-black dark:focus-visible:ring-black/20";

const FormSchema = z.object({
    username: z.string().min(1, "Username is required").max(20),
    email: z.string().min(1, "Email is required").email("Invalid email"),
    password: z
        .string()
        .min(1, "Password is required")
        .min(8, "Password must have more than 8 characters"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
    location: z.string().min(1, "Location is required"),
}).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
});

type LocationSuggestion = {
    id: string;
    label: string;
    city: string | null;
    state: string | null;
    country: string | null;
    lat: number;
    lng: number;
};

const SignUpForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const googleMode = searchParams?.get("google") === "1";
    const googleEmail = searchParams?.get("email") ?? "";
    const googleName = searchParams?.get("name") ?? "";
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

    // Structured location pieces captured from the autocomplete
    const [city, setCity] = useState("");
    const [stateRegion, setStateRegion] = useState("");
    const [country, setCountry] = useState("");
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);

    const onSubmit = async (values: z.infer<typeof FormSchema>) => {
        // Step 1: Sign up
        const response = await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: values.username,
                email: values.email,
                password: values.password,
                location: values.location, // display label
                // NEW: structured location fields
                city,
                state: stateRegion,
                country,
                lat,
                lng,
            }),
        });

        if (response.ok) {
            // Step 2: Immediately sign the user in (so onboarding has a session)
            const signInRes = await signIn("credentials", {
                redirect: false,
                email: values.email,
                password: values.password,
            });

            if (signInRes && !signInRes.error) {
                // Step 3: Redirect to onboarding page (with username in query param)
                router.push(`/user-onboarding?username=${encodeURIComponent(values.username)}`);
            } else {
                toast("Error", {
                    description: "Sign in failed after registration.",
                });
            }
        } else {
            toast("Error", {
                description: "Oops! Something went wrong.",
            });
        }
    };

    if (googleMode) {
        return (
            <div className="flex flex-col gap-4 text-center">
                <h1 className="text-3xl text-center mb-2 text-black dark:text-black">Sign Up</h1>
                <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-300 dark:bg-yellow-50 dark:text-yellow-900">
                    <p className="font-semibold mb-1">Finish linking your Google account</p>
                    <p>
                        We found a Google sign-in for <span className="font-semibold">{googleEmail || "your email"}</span>, but it
                        hasn&apos;t been onboarded yet. Please complete onboarding to finish setting up your profile.
                    </p>
                </div>
                <Button
                    type="button"
                    className="w-full bg-green-700 text-white hover:bg-black dark:bg-green-700 dark:text-white dark:hover:bg-black"
                    onClick={() =>
                        router.push(
                            `/user-onboarding${googleName ? `?username=${encodeURIComponent(googleName)}` : ""}`
                        )
                    }
                >
                    Continue to onboarding
                </Button>
                <p className="text-sm text-gray-600 dark:text-gray-600">
                    Need to try a different account?{" "}
                    <Link className="text-green-600 hover:underline dark:text-green-600" href="/log-in">
                        Return to log in
                    </Link>
                </p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <h1 className="text-3xl text-center mb-4 text-black dark:text-black">Sign Up</h1>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
                <div className="space-y-4">
                    {/* Username */}
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black dark:text-black">Username</FormLabel>
                                <FormControl className="bg-white dark:bg-white">
                                    <Input placeholder="john-doe" {...field} className={LOCKED_INPUT_CLASS} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {/* Email */}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black dark:text-black">Email</FormLabel>
                                <FormControl className="bg-white dark:bg-white">
                                    <Input placeholder="johndoe@email.com" {...field} className={LOCKED_INPUT_CLASS} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {/* Password */}
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black dark:text-black">Password</FormLabel>
                                <FormControl className="bg-white dark:bg-white">
                                    <Input placeholder="Enter your password" type="password" {...field} className={LOCKED_INPUT_CLASS} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {/* Confirm Password */}
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black dark:text-black">Re-Enter your password</FormLabel>
                                <FormControl className="bg-white dark:bg-white">
                                    <Input placeholder="Re-Enter your password" type="password" {...field} className={LOCKED_INPUT_CLASS} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* City Location (with Open-Meteo autocomplete) */}
                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black dark:text-black">City Location</FormLabel>
                                <FormControl className="bg-white dark:bg-white">
                                    <LocationAutocomplete
                                        value={field.value}
                                        onChangeLabel={field.onChange}
                                        onSelectSuggestion={(s) => {
                                            // Update the form's visible "location" value
                                            field.onChange(s.label);

                                            // Capture structured pieces for backend
                                            setCity(s.city || "");
                                            setStateRegion(s.state || "");
                                            setCountry(s.country || "");
                                            setLat(s.lat);
                                            setLng(s.lng);
                                        }}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                <Button className="w-full mt-6 bg-green-700 text-white hover:bg-black dark:bg-green-700 dark:text-white dark:hover:bg-black" type="submit">
                    Sign Up
                </Button>
            </form>

            <div
                className="mx-auto my-4 flex w-full items-center justify-evenly before:mr-4 before:block
            before:h-px before:flex-grow before:bg-stone-400 after:ml-4 after:block after:h-px after:flex-grow
            after:bg-stone-400 dark:before:bg-stone-400 dark:after:bg-stone-400"
            >
                or
            </div>
            <GoogleSignInButton callbackUrl="/user-onboarding" className="w-full bg-white text-black border border-zinc-200 hover:bg-zinc-50 dark:bg-white dark:text-black dark:hover:bg-zinc-50">
                Sign Up with Google
            </GoogleSignInButton>
            <p className="text-center text-sm text-gray-600 mt-2 dark:text-gray-600">
                If you already have an account, please&nbsp;
                <Link className="text-green-500 hover:underline dark:text-green-500" href="/log-in">
                    Log In
                </Link>
            </p>
        </Form>
    );
};

export default SignUpForm;

/**
 * LocationAutocomplete
 * - Debounces calls to /api/location-search (Open-Meteo)
 * - Shows dropdown of city suggestions
 * - On select: passes label + city/state/country + lat/lng back up
 */
function LocationAutocomplete({
    value,
    onChangeLabel,
    onSelectSuggestion,
}: {
    value: string;
    onChangeLabel: (val: string) => void;
    onSelectSuggestion: (s: LocationSuggestion) => void;
}) {
    const [input, setInput] = useState(value || "");
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);

    // keep local input in sync with external value changes (e.g. form reset)
    useEffect(() => {
        setInput(value || "");
    }, [value]);

    // Debounced search against /api/location-search
    useEffect(() => {
        if (!input || input.length < 2) {
            setSuggestions([]);
            return;
        }

        const handle = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/location-search?q=${encodeURIComponent(input)}`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                setSuggestions(json.results || []);
                setOpen((json.results || []).length > 0);
            } catch {
                setSuggestions([]);
                setOpen(false);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(handle);
    }, [input]);

    const handleSelect = (s: LocationSuggestion) => {
        onSelectSuggestion(s);
        setInput(s.label);
        setOpen(false);
    };

    return (
        <div className="relative w-full">
            <Input className={LOCKED_INPUT_CLASS}
                placeholder="Enter the city you live in"
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                    onChangeLabel(e.target.value);
                }}
                onFocus={() => {
                    if (suggestions.length) setOpen(true);
                }}
            />
            {loading && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400">
                    …
                </div>
            )}

            {open && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow max-h-60 overflow-y-auto dark:bg-white dark:border-zinc-200">
                    {suggestions.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 dark:text-black"
                            onClick={() => handleSelect(s)}
                        >
                            <div className="font-medium">{s.label}</div>
                            <div className="text-xs text-gray-500">
                                {[s.city, s.state, s.country].filter(Boolean).join(", ")}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
