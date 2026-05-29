'use client';

type GymSearchProfileFieldsProps = {
    amenitiesText: string;
    gymFee: string;
    website: string;
    showWebsiteButton: boolean;
    hiringTrainers: boolean;
    onAmenitiesChange: (value: string) => void;
    onGymFeeChange: (value: string) => void;
    onGymFeeBlur: () => void;
    onWebsiteChange: (value: string) => void;
    onToggleShowWebsite: () => void;
    onToggleHiringTrainers: () => void;
};

export default function GymSearchProfileFields({
    amenitiesText,
    gymFee,
    website,
    showWebsiteButton,
    hiringTrainers,
    onAmenitiesChange,
    onGymFeeChange,
    onGymFeeBlur,
    onWebsiteChange,
    onToggleShowWebsite,
    onToggleHiringTrainers,
}: GymSearchProfileFieldsProps) {
    return (
        <div className="mb-6 space-y-6">
            <div>
                <label className="mb-1 block text-sm font-medium">Amenities</label>
                <textarea
                    className="min-h-[100px] w-full rounded-md border px-3 py-2 text-sm outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                    placeholder="Describe equipment, classes, parking, locker rooms..."
                    value={amenitiesText}
                    onChange={(e) => onAmenitiesChange(e.target.value)}
                />
            </div>

            <div className="w-full max-w-xs">
                <label className="mb-1 block text-sm font-medium">Monthly membership fee</label>
                <div className="flex items-center rounded-md border px-3 dark:border-white/20">
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">$</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className="w-full bg-transparent px-2 py-2 text-sm outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:text-gray-100"
                        placeholder="0.00"
                        value={gymFee}
                        onChange={(e) => onGymFeeChange(e.target.value)}
                        onBlur={onGymFeeBlur}
                    />
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">/month</span>
                </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
                <div className="flex flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-2">
                        <p className="whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Show website on profile</p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showWebsiteButton}
                        onClick={onToggleShowWebsite}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                            showWebsiteButton ? "bg-green-700 dark:bg-green-500" : "bg-gray-300 dark:bg-neutral-700"
                        }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                showWebsiteButton ? "translate-x-5" : "translate-x-1"
                            }`}
                        />
                    </button>
                </div>

                {showWebsiteButton && (
                    <div>
                        <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                            Website URL
                        </label>
                        <input
                            type="url"
                            className="w-full rounded border px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:border-white/10 dark:bg-transparent dark:text-gray-100"
                            value={website}
                            onChange={(e) => onWebsiteChange(e.target.value)}
                            placeholder="https://example.com"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                    </div>
                )}

                <div className="flex flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-2">
                        <p className="whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Actively hiring trainers</p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={hiringTrainers}
                        onClick={onToggleHiringTrainers}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                            hiringTrainers ? "bg-green-700 dark:bg-green-500" : "bg-gray-300 dark:bg-neutral-700"
                        }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                hiringTrainers ? "translate-x-5" : "translate-x-1"
                            }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}
