'use client';

import { useEffect, useState } from "react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

const LOCKED_INPUT_CLASS =
    "bg-white text-black border border-zinc-200 placeholder:text-zinc-500 focus-visible:border-black focus-visible:ring-black/20";

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
    const [status, setStatus] = useState<"form" | "pending">("form");
    const [pendingEmail, setPendingEmail] = useState("");
    const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
    const [formError, setFormError] = useState<string | null>(null);

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
        setFormError(null);
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
            setPendingEmail(values.email);
            setStatus("pending");
        } else {
            const data = await response.json().catch(() => null);
            setFormError(data?.message || "Oops! Something went wrong.");
        }
    };

    const handleResendVerification = async () => {
        if (!pendingEmail) return;
        setResendStatus("sending");
        try {
            await fetch("/api/auth/verify-email/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: pendingEmail }),
            });
            setResendStatus("sent");
        } catch {
            setResendStatus("idle");
            setFormError("Unable to resend verification email right now.");
        }
    };

    if (status === "pending") {
        return (
            <div className="space-y-4 text-center">
                <h1 className="text-3xl font-semibold text-black">Verify your email</h1>
                <p className="text-sm text-gray-600">
                    We sent a verification link to <span className="font-medium">{pendingEmail}</span>. Click the link in that email to
                    continue to onboarding.
                </p>
                <div className="space-y-2">
                    <Button
                        type="button"
                        className="w-full bg-green-700 text-white hover:bg-black"
                        onClick={handleResendVerification}
                        disabled={resendStatus === "sending"}
                    >
                        {resendStatus === "sending" ? "Sending…" : "Resend email"}
                    </Button>
                    {resendStatus === "sent" && (
                        <p className="text-xs text-green-600">Another verification email has been sent.</p>
                    )}
                </div>
                <p className="text-sm text-gray-600">
                    Already verified?{" "}
                    <Link className="text-green-600 hover:underline" href="/log-in">
                        Return to log in
                    </Link>
                </p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <h1 className="text-3xl text-center mb-4 text-black">Sign Up</h1>
            {status === "form" && formError && (
                <Alert className="mb-4 border border-red-200 bg-red-50 text-red-900 shadow-none">
                    <AlertTitle className="text-red-900">Unable to sign up</AlertTitle>
                    <AlertDescription className="text-red-800">{formError}</AlertDescription>
                </Alert>
            )}
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
                <div className="space-y-4">
                    {/* Username */}
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="mb-2 text-black">Username</FormLabel>
                                <FormControl className="bg-white">
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
                                <FormLabel className="mb-2 text-black">Email</FormLabel>
                                <FormControl className="bg-white">
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
                                <FormLabel className="mb-2 text-black">Password</FormLabel>
                                <FormControl className="bg-white">
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
                                <FormLabel className="mb-2 text-black">Re-Enter your password</FormLabel>
                                <FormControl className="bg-white">
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
                                <FormLabel className="mb-2 text-black">City Location</FormLabel>
                                <FormControl className="bg-white">
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

                <Button className="w-full mt-6 bg-green-700 text-white hover:bg-black" type="submit">
                    Sign Up
                </Button>
            </form>

            <div
                className="mx-auto my-4 flex w-full items-center justify-evenly text-black dark:text-black before:mr-4 before:block
            before:h-px before:flex-grow before:bg-stone-400 after:ml-4 after:block after:h-px after:flex-grow
        after:bg-stone-400"
            >
                or
            </div>
            <p className="text-center text-sm text-gray-600 mt-2">
                If you already have an account, please&nbsp;
                <Link className="text-green-500 hover:underline" href="/log-in">
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
                <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow max-h-60 overflow-y-auto">
                    {suggestions.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
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
