'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { useSearchParams } from 'next/navigation';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "../../../components/ui/form";
import { Input } from '../../../components/ui/input';
import { Button } from "../../../components/ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const OPTIONS = [
    "weight loss", "build strength", "improve endurance",
    "flexibility & mobility", "sport performance", "injury recovery"
];

// TOP: update GymFormSchema so fee is a number (coerced from input)
// in user-onboarding/page.tsx
const GymFormSchema = z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    phone: z.string().min(1),
    website: z.string().min(1),
    fee: z.coerce.number().positive("Fee must be a positive number"),
});



const roleOptions = [
    {
        label: "Trainee",
        color: "bg-green-100",
        icon: (
            <svg width="64" height="64" fill="none" viewBox="0 0 64 64">
                <circle cx="32" cy="20" r="10" fill="black" />
                <rect x="16" y="36" width="32" height="18" rx="6" fill="black" />
                <rect x="22" y="50" width="6" height="8" rx="3" fill="black" />
                <rect x="36" y="50" width="6" height="8" rx="3" fill="black" />
            </svg>
        ),
    },
    {
        label: "Trainer",
        color: "bg-purple-100",
        icon: (
            <svg width="64" height="64" fill="none" viewBox="0 0 64 64">
                <circle cx="32" cy="16" r="8" fill="black" />
                <rect x="14" y="36" width="36" height="8" rx="4" fill="black" />
                <rect x="22" y="44" width="8" height="10" rx="4" fill="black" />
                <rect x="34" y="44" width="8" height="10" rx="4" fill="black" />
                <circle cx="32" cy="36" r="6" fill="black" />
            </svg>
        ),
    },
    {
        label: "Gym",
        color: "bg-blue-100",
        icon: (
            <svg width="64" height="64" fill="none" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" stroke="black" strokeWidth="4" />
                <rect x="24" y="28" width="16" height="8" rx="2" fill="black" />
                <rect x="18" y="26" width="4" height="12" rx="2" fill="black" />
                <rect x="42" y="26" width="4" height="12" rx="2" fill="black" />
            </svg>
        ),
    },
];





export default function UserOnboarding() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const userName = searchParams.get('username') || 'there';

    const [step, setStep] = useState(1);
    const [role, setRole] = useState<string | null>(null);
    const [selections, setSelections] = useState<string[]>([]);
    const [gymForm, setGymForm] = useState({ name: '', address: '', phone: '', website: '', fee: '' });

    const gymFormHook = useForm({
        resolver: zodResolver(GymFormSchema),
        defaultValues: {
            name: "",
            address: "",
            phone: "",
            website: "",
            fee: "",
        }
    });

    const handleRoleCardSelect = (r: string) => {
        setRole(r);
    };

    const handleRoleNext = () => {
        if (role) setStep(2);
    };

    const toggleSelection = (option: string) => {
        setSelections(selections =>
            selections.includes(option)
                ? selections.filter(o => o !== option)
                : [...selections, option]
        );
    };

    const handleGymInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGymForm({ ...gymForm, [e.target.name]: e.target.value });
    };

    const handleGymProfileSubmit = gymFormHook.handleSubmit(async (values) => {
        try {
            const res = await fetch("/api/user/update-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role: "GYM",
                    gymForm: values,   // fee is already a number
                    selections: [],
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.error("Update role failed:", errJson);
                throw new Error(errJson?.message || "Failed to update role");
            }

            const data = await res.json();
            console.log("User updated:", data);
            router.push("/log-in");
            // route wherever you want after onboarding
        } catch (err) {
            console.error(err);
        }
    });


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/user/update-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    role: role?.toUpperCase(),
                    selections,
                    // No gymForm here
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.error("Update role failed:", errJson);
                throw new Error(errJson?.message || "Failed to update role");
            }

            const data = await res.json();
            console.log("User updated:", data);
            router.push("/profile");
        } catch (err) {
            console.error("Update failed:", err);
        }
    };

    return (
        <div className={`w-full min-h-screen flex flex-col items-center justify-center`}>
            {step === 1 && (
                <div className="flex flex-col items-center">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold mb-1">
                            Welcome, <span className="text-black">{userName}</span>!
                        </h2>
                        <p className="text-xl text-black">Please select your identity</p>
                    </div>
                    <div className="flex gap-12 mb-16">
                        {roleOptions.map(({ label, color, icon }) => (
                            <button
                                key={label}
                                type="button"
                                className={`flex flex-col items-center justify-center w-48 h-48 rounded-2xl transition 
                                shadow-md hover:scale-105 hover:shadow-xl active:scale-100
                                ${color} ${role === label ? "border-4 border-black" : "border border-transparent"}`}
                                onClick={() => handleRoleCardSelect(label)}
                            >
                                <span className="mb-2 font-semibold text-lg lowercase text-black">{label}</span>
                                {icon}
                            </button>
                        ))}
                    </div>
                    <button
                        className={`mt-2 w-16 h-16 flex items-center justify-center rounded-full border-2 border-black transition
                        ${role ? "hover:bg-black hover:text-white" : "opacity-50 cursor-not-allowed"}`}
                        disabled={!role}
                        onClick={handleRoleNext}
                        aria-label="Next"
                    >
                        <ArrowRight size={32} />
                    </button>
                </div>
            )}

            {step === 2 && (role === 'Trainee' || role === 'Trainer') && (
                <div className="flex flex-col items-center gap-8">
                    <h2 className="text-3xl font-bold text-center">
                        {role === 'Trainee' ? 'What are your goals?' : 'What services do you offer?'}
                    </h2>
                    <div className="grid grid-cols-3 gap-6">
                        {OPTIONS.map((option) => {
                            const isSelected = selections.includes(option);

                            // Get unique background color
                            const bgColorMap: Record<string, string> = {
                                "weight loss": "bg-green-100",
                                "build strength": "bg-red-100",
                                "improve endurance": "bg-blue-100",
                                "flexibility & mobility": "bg-yellow-200",
                                "sport performance": "bg-purple-200",
                                "injury recovery": "bg-yellow-100",
                            };

                            // Get unique SVG icon (you can expand this map to return JSX elements later)
                            const iconMap: Record<string, JSX.Element> = {
                                "weight loss": <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2"><path d="M12 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zM8 14a4 4 0 0 1 8 0v5H8v-5z" /></svg>,
                                "build strength": <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2"><path d="M17 8a4 4 0 0 0-4-4M3 12c0-3.314 2.686-6 6-6m-2 6v4a2 2 0 0 0 2 2h3v3" /></svg>,
                                "improve endurance": <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2"><path d="M18 8l4 4-4 4M3 12h19" /></svg>,
                                "flexibility & mobility": <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2"><path d="M12 6v12M6 12h12" /></svg>,
                                "sport performance": <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M2 12h2m16 0h2" /></svg>,
                                "injury recovery": <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2"><path d="M12 4v4M12 16v4M8 12h8" /></svg>,
                            };

                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => toggleSelection(option)}
                                    className={`w-40 h-40 flex flex-col items-center justify-center rounded-xl p-4 transition 
                            ${bgColorMap[option]} 
                            ${isSelected ? 'border-4 border-blue-500' : 'border border-transparent'}`}
                                >
                                    <div className="mb-2">{iconMap[option]}</div>
                                    <p className="text-center font-semibold lowercase text-black">{option}</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Navigation Arrows */}
                    <div className="flex gap-6">
                        <button
                            onClick={() => setStep(1)}
                            className="w-12 h-12 border-2 border-black rounded-full flex items-center justify-center hover:bg-black hover:text-white transition"
                            aria-label="Back"
                        >
                            ←
                        </button>
                        <button
                            type="button"
                            disabled={selections.length === 0}
                            onClick={handleSubmit}
                            className={`w-12 h-12 border-2 rounded-full flex items-center justify-center transition 
                    ${selections.length > 0
                                    ? 'border-black hover:bg-black hover:text-white'
                                    : 'border-gray-300 text-gray-300 cursor-not-allowed'}`}
                            aria-label="Next"
                        >
                            →
                        </button>
                    </div>
                </div>

            )}

            {step === 2 && role === 'Gym' && (
                <div className='bg-slate-200 p-10 rounded-md w-full max-w-md'>
                <Form {...gymFormHook}>
                    <h2 className="text-3xl text-center mb-4">Create Gym Profile</h2>
                    <form onSubmit={handleGymProfileSubmit} className="w-full">
                        <div className="space-y-4">
                            <FormField
                                control={gymFormHook.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-2">Organization Name</FormLabel>
                                        <FormControl className="bg-white">
                                            <Input placeholder="Organization Name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-2">Address</FormLabel>
                                        <FormControl className="bg-white">
                                            <Input placeholder="Address" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-2">Phone Number</FormLabel>
                                        <FormControl className="bg-white">
                                            <Input placeholder="Phone Number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-2">Website URL</FormLabel>
                                        <FormControl className="bg-white">
                                            <Input placeholder="Website URL" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="fee"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-2">Base Membership Fee</FormLabel>
                                        <FormControl className="bg-white">
                                            <Input placeholder="Base Membership Fee" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Button className="w-full mt-6" type="submit">
                            Finish
                        </Button>
                    </form>
                </Form>
                </div>
            )}
        </div>
    );
}
