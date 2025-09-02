'use client';

import { useEffect, useState } from "react";
import { Search as SearchIcon, ChevronDown } from "lucide-react";
import clsx from "clsx";
import Navbar from "@/components/Navbar";

const GOALS = [
    "weight loss",
    "build strength",
    "improve endurance",
    "flexibility & mobility",
    "sport performance",
    "injury recovery",
];

export default function SearchPage() {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [goal, setGoal] = useState<string[]>([]);
    const [minBudget, setMinBudget] = useState("");
    const [maxBudget, setMaxBudget] = useState("");
    const [distance, setDistance] = useState("");
    const [results, setResults] = useState<any[]>([]);

    const [showGoals, setShowGoals] = useState(false);

    // Fetch users whenever a filter changes (or on mount, will fetch all users)
    useEffect(() => {
        const params = new URLSearchParams();
        if (name) params.append("name", name);
        if (role) params.append("role", role);
        goal.forEach(g => params.append("goal", g));
        if (minBudget) params.append("minBudget", minBudget);
        if (maxBudget) params.append("maxBudget", maxBudget);
        if (distance) params.append("distance", distance);

        // Will fetch all users if params is empty (default)
        fetch("/api/search-users?" + params.toString())
            .then(res => res.json())
            .then(setResults);
    }, [name, role, goal, minBudget, maxBudget, distance]);

    // Reset all filters
    const resetFilters = () => {
        setName("");
        setRole("");
        setGoal([]);
        setMinBudget("");
        setMaxBudget("");
        setDistance("");
    };

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="w-full bg-white py-6 flex items-center pl-[40px] z-20 border-b">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none mr-8">
                    <span>search</span>
                </h1>
                {/* Search bar */}
                <div className="relative flex items-center">
                    <SearchIcon className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Search by name"
                        className="pl-10 pr-3 py-2 w-[230px] rounded-full border border-gray-200 bg-[#f8f8f8] focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                </div>

                {/* Distance filter */}
                <select
                    className="ml-6 px-4 py-2 rounded-full border border-gray-200 bg-[#f8f8f8] text-gray-700 focus:outline-none"
                    value={distance}
                    onChange={e => setDistance(e.target.value)}
                >
                    <option value="">distance</option>
                    <option value="5">≤ 5 mi</option>
                    <option value="10">≤ 10 mi</option>
                    <option value="25">≤ 25 mi</option>
                    <option value="50">≤ 50 mi</option>
                </select>

                {/* Role filter */}
                <select
                    className="ml-2 px-4 py-2 rounded-full border border-gray-200 bg-[#f8f8f8] text-gray-700 focus:outline-none"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                >
                    <option value="">entity</option>
                    <option value="TRAINEE">trainee</option>
                    <option value="TRAINER">trainer</option>
                    <option value="GYM">gym</option>
                </select>

                {/* Budget filter */}
                <div className="ml-2 flex items-center gap-2">
                    <span className="text-sm text-gray-600">budget:</span>
                    <input
                        type="number"
                        value={minBudget}
                        onChange={e => setMinBudget(e.target.value)}
                        placeholder="min"
                        className="w-14 px-2 py-1 rounded border border-gray-200"
                        min={0}
                    />
                    <span className="mx-1 text-gray-500">-</span>
                    <input
                        type="number"
                        value={maxBudget}
                        onChange={e => setMaxBudget(e.target.value)}
                        placeholder="max"
                        className="w-14 px-2 py-1 rounded border border-gray-200"
                        min={0}
                    />
                </div>

                {/* Goals multiselect */}
                <div className="ml-2 relative">
                    <button
                        className={clsx(
                            "flex items-center px-4 py-2 rounded-full border border-gray-200 bg-[#f8f8f8] text-gray-700",
                            showGoals && "ring-2 ring-green-100"
                        )}
                        onClick={() => setShowGoals(v => !v)}
                        type="button"
                    >
                        goals <ChevronDown className="ml-1 w-4 h-4" />
                    </button>
                    {showGoals && (
                        <div className="absolute left-0 mt-2 bg-white border rounded shadow-lg p-2 z-50 w-48">
                            {GOALS.map(g => (
                                <label key={g} className="flex items-center py-1 px-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={goal.includes(g)}
                                        onChange={() => setGoal(goal =>
                                            goal.includes(g) ? goal.filter(x => x !== g) : [...goal, g]
                                        )}
                                        className="mr-2"
                                    />
                                    <span className="text-gray-700">{g}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Reset button */}
                <button
                    className="ml-4 px-3 py-1 rounded border text-xs text-gray-600 bg-white hover:bg-gray-100"
                    onClick={resetFilters}
                >
                    Reset Filters
                </button>
            </header>

            {/* Results */}
            <div className="max-w-2xl mx-auto mt-6">
                {results.length === 0 ? (
                    <div className="text-gray-400 text-center py-12">No results</div>
                ) : (
                    <ul>
                        {results.map((user) => (
                            <li key={user.id} className="bg-white rounded-xl shadow p-4 mb-4 flex items-center">
                                <img
                                    src={user.image || "/default-avatar.png"}
                                    alt={user.name || user.username || ""}
                                    className="w-12 h-12 rounded-full object-cover mr-4"
                                />
                                <div>
                                    <div className="font-semibold text-lg">{user.name || user.username}</div>
                                    <div className="text-sm text-gray-500 capitalize">{user.role?.toLowerCase()}</div>
                                    {/* Trainer Info */}
                                    {user.role === "TRAINER" && user.trainerProfile && (
                                        <div>
                                            <div className="text-xs text-gray-700">
                                                Rate: ${user.trainerProfile.hourlyRate ?? "N/A"}/hr
                                            </div>
                                            <div className="text-xs text-gray-700">
                                                Services: {user.trainerProfile.services?.join(", ") || "None"}
                                            </div>
                                            <div className="text-xs text-gray-700">
                                                Location: {[user.trainerProfile.city, user.trainerProfile.state, user.trainerProfile.country].filter(Boolean).join(", ")}
                                            </div>
                                        </div>
                                    )}
                                    {/* Trainee Info */}
                                    {user.role === "TRAINEE" && user.traineeProfile && (
                                        <div>
                                            <div className="text-xs text-gray-700">
                                                Goals: {user.traineeProfile.goals?.join(", ") || "None"}
                                            </div>
                                            <div className="text-xs text-gray-700">
                                                Location: {[user.traineeProfile.city, user.traineeProfile.state, user.traineeProfile.country].filter(Boolean).join(", ")}
                                            </div>
                                        </div>
                                    )}
                                    {/* Gym Info */}
                                    {user.role === "GYM" && user.gymProfile && (
                                        <div>
                                            <div className="text-xs text-gray-700">
                                                Fee: ${user.gymProfile.fee ?? "N/A"}/mo
                                            </div>
                                            <div className="text-xs text-gray-700">
                                                Amenities: {user.gymProfile.amenities?.join(", ") || "None"}
                                            </div>
                                            <div className="text-xs text-gray-700">
                                                Location: {[user.gymProfile.city, user.gymProfile.state, user.gymProfile.country].filter(Boolean).join(", ")}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <Navbar />
        </div>
    );
}
