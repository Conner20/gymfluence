'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useSession } from 'next-auth/react';

const OPTIONS = [
    "weight loss", "build strength", "improve endurance",
    "flexibility & mobility", "sport performance", "injury recovery"
];

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
    const { data: session } = useSession();
    const userName = session?.user?.username || 'there';

    const [step, setStep] = useState(1);
    const [role, setRole] = useState<string | null>(null);
    const [selections, setSelections] = useState<string[]>([]);
    const [gymForm, setGymForm] = useState({ name: '', address: '', phone: '', website: '', fee: '' });

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Post to your API
        router.push('/log-in');
    };

    return (
        <div className={`w-full min-h-screen flex flex-col items-center justify-center bg-white`}>
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
                        ${role ? "bg-white hover:bg-black hover:text-white" : "opacity-50 cursor-not-allowed"}`}
                        disabled={!role}
                        onClick={handleRoleNext}
                        aria-label="Next"
                    >
                        <ArrowRight size={32} />
                    </button>
                </div>
            )}

            {step === 2 && (role === 'Trainee' || role === 'Trainer') && (
                <form onSubmit={handleSubmit} className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-lg mt-0">
                    <h2 className="text-xl font-semibold mb-4 text-center">
                        {role === 'Trainee' ? 'What are your goals?' : 'What services do you offer?'}
                    </h2>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {OPTIONS.map(option => (
                            <button
                                key={option}
                                type="button"
                                className={`px-4 py-2 rounded-full border 
                                ${selections.includes(option) ? 'bg-green-500 text-white' : 'bg-white'}`}
                                onClick={() => toggleSelection(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    <button className="btn w-full mt-2" type="submit" disabled={selections.length === 0}>Finish</button>
                </form>
            )}

            {step === 2 && role === 'Gym' && (
                <form onSubmit={handleSubmit} className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-lg mt-0">
                    <h2 className="text-xl font-semibold mb-4 text-center">Create Gym Profile</h2>
                    <input name="name" placeholder="Organization Name" className="input" value={gymForm.name} onChange={handleGymInput} required />
                    <input name="address" placeholder="Address" className="input" value={gymForm.address} onChange={handleGymInput} required />
                    <input name="phone" placeholder="Phone Number" className="input" value={gymForm.phone} onChange={handleGymInput} required />
                    <input name="website" placeholder="Website URL" className="input" value={gymForm.website} onChange={handleGymInput} required />
                    <input name="fee" placeholder="Base Membership Fee" className="input" value={gymForm.fee} onChange={handleGymInput} required />
                    <button className="btn w-full mt-2" type="submit">Finish</button>
                </form>
            )}
        </div>
    );
}
