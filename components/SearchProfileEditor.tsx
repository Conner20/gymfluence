'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import clsx from "clsx";
import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import GymSearchProfileFields from "@/components/search-profile/GymSearchProfileFields";
import TraineeSearchProfileFields from "@/components/search-profile/TraineeSearchProfileFields";
import TrainerSearchProfileFields from "@/components/search-profile/TrainerSearchProfileFields";

type Role = "TRAINEE" | "TRAINER" | "GYM" | null;

type SearchProfileEditorProps = {
    // A counter from the parent: whenever it changes, we run our own onSave().
    externalSaveTrigger?: number;
    className?: string;
};

type GalleryItem = {
    id: string;
    url: string;
    persisted: boolean;
    file?: File;
};

type GymSuggestion = {
    id: string;
    name: string;
    address?: string | null;
};

type TrainerSuggestion = {
    id: string;
    username: string | null;
    name: string | null;
};

type SearchProfileSnapshot = {
    role: Role;
    about: string;
    goals: string[];
    traineeTrainerStatus: "" | "LOOKING" | "TRAINING_WITH";
    traineeGymStatus: "" | "LOOKING" | "MEMBER";
    associatedTrainerId: string;
    associatedGymId: string;
    associatedGymName: string;
    services: string[];
    hourlyRate: string;
    trainerGymStatus: "" | "LOOKING" | "TRAINER";
    amenitiesText: string;
    gymFee: string;
    website: string;
    showWebsiteButton: boolean;
    hiringTrainers: boolean;
    galleryUrls: string[];
};

const searchProfileCopy = {
    TRAINEE: {
        title: "Search Profile",
        description:
            "Customize how you appear in Search so others can better understand your goals.",
        aboutLabel: "About you",
        aboutPlaceholder: "Describe your goals, experience, interests...",
        imagesLabel: "Progress Images",
        imagesEmpty: "Upload photos of your progress",
        uploadLabel: "",
    },
    TRAINER: {
        title: "Search Profile",
        description:
            "Customize how you appear in Search and show clients and gyms why you're a fit.",
        aboutLabel: "About you",
        aboutPlaceholder: "Describe your coaching style, experience, certifications...",
        imagesLabel: "Profile Images",
        imagesEmpty: "Upload photos of your training",
        uploadLabel: "",
    },
    GYM: {
        title: "Search Profile",
        description:
            "Customize how your gym appears in Search and show members and trainers why it's a fit.",
        aboutLabel: "About your gym",
        aboutPlaceholder: "Describe your facility, atmosphere, community...",
        imagesLabel: "Facility Images",
        imagesEmpty: "Upload photos of your gym",
        uploadLabel: "",
    },
} as const;

export default function SearchProfileEditor({
    externalSaveTrigger,
    className,
}: SearchProfileEditorProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [savedState, setSavedState] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [role, setRole] = useState<Role>(null);
    const [about, setAbout] = useState("");
    const [goals, setGoals] = useState<string[]>([]);
    const [traineeTrainerStatus, setTraineeTrainerStatus] = useState<"" | "LOOKING" | "TRAINING_WITH">("");
    const [traineeGymStatus, setTraineeGymStatus] = useState<"" | "LOOKING" | "MEMBER">("");
    const [associatedTrainer, setAssociatedTrainer] = useState<TrainerSuggestion | null>(null);
    const [trainerFieldInvalid, setTrainerFieldInvalid] = useState(false);
    const [gymFieldInvalid, setGymFieldInvalid] = useState(false);
    const [services, setServices] = useState<string[]>([]);
    const [hourlyRate, setHourlyRate] = useState<string>("0.00");
    const [trainerGymStatus, setTrainerGymStatus] = useState<"" | "LOOKING" | "TRAINER">("");
    const [associatedGym, setAssociatedGym] = useState<GymSuggestion | null>(null);
    const [trainerGymFieldInvalid, setTrainerGymFieldInvalid] = useState(false);
    const [amenitiesText, setAmenitiesText] = useState<string>(""); // NEW: free-form amenities
    const [gymFee, setGymFee] = useState<string>("");
    const [website, setWebsite] = useState("");
    const [showWebsiteButton, setShowWebsiteButton] = useState(false);
    const [hiringTrainers, setHiringTrainers] = useState(false);

    // gallery
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [removedGalleryUrls, setRemovedGalleryUrls] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const [initialSnapshot, setInitialSnapshot] = useState<SearchProfileSnapshot | null>(null);

    const coreGoals = [
        "weight loss",
        "build strength",
        "improve endurance",
        "flexibility & mobility",
        "sport performance",
        "injury recovery",
    ];

    // Unique lists that include any custom items user already has
    const traineeChoices = useMemo(() => {
        const set = new Set<string>([...coreGoals, ...goals]);
        return Array.from(set);
    }, [goals]);

    const trainerChoices = useMemo(() => {
        const set = new Set<string>([...coreGoals, ...services]); // reusing coreGoals as sensible defaults
        return Array.from(set);
    }, [services]);

    const normalizeCurrencyValue = (value: string) => {
        const digits = value.replace(/\D/g, "").slice(0, 9);
        if (!digits) return "0.00";

        const cents = Number(digits);
        return (cents / 100).toFixed(2);
    };

    useEffect(() => {
        (async () => {
            try {
                setErr(null);
                setLoading(true);

                const [profRes, galRes] = await Promise.all([
                    fetch("/api/user/search-profile", { cache: "no-store" }),
                    fetch("/api/user/search-gallery", { cache: "no-store" }),
                ]);

                if (!profRes.ok) throw new Error("Failed to load search profile");
                const prof = await profRes.json();

                setRole(prof.role ?? null);
                setAbout(prof.about ?? "");

                if (prof.role === "TRAINEE") {
                    setGoals(prof.goals ?? []);
                    setTraineeTrainerStatus(prof.traineeTrainerStatus || "");
                    setTraineeGymStatus(prof.traineeGymStatus || "");
                    setAssociatedTrainer(
                        prof.associatedTrainer
                            ? {
                                  id: prof.associatedTrainer.id,
                                  username: prof.associatedTrainer.username,
                                  name: prof.associatedTrainer.name,
                              }
                            : null
                    );
                    setAssociatedGym(
                        prof.traineeGymName
                            ? {
                                  id: prof.traineeGymPlaceId || prof.traineeGymName,
                                  name: prof.traineeGymName,
                              }
                            : null
                    );
                } else if (prof.role === "TRAINER") {
                    setServices(prof.services ?? []);
                    setHourlyRate(
                        typeof prof.hourlyRate === "number" && !Number.isNaN(prof.hourlyRate)
                            ? prof.hourlyRate.toFixed(2)
                            : "0.00"
                    );
                    setWebsite(prof.website ?? "");
                    setShowWebsiteButton(Boolean(prof.showWebsiteButton));
                    setTrainerGymStatus(prof.trainerGymStatus || "");
                    setAssociatedGym(
                        prof.trainerGymName
                            ? {
                                  id: prof.trainerGymPlaceId || prof.trainerGymName,
                                  name: prof.trainerGymName,
                              }
                            : null
                    );
                } else if (prof.role === "GYM") {
                    setAmenitiesText(prof.amenitiesText ?? ""); // NEW
                    setGymFee(
                        typeof prof.gymFee === "number" && !Number.isNaN(prof.gymFee)
                            ? prof.gymFee.toFixed(2)
                            : ""
                    );
                    setWebsite(prof.gymWebsite ?? "");
                    setShowWebsiteButton(Boolean(prof.showWebsiteButton));
                    setHiringTrainers(Boolean(prof.hiringTrainers));
                }

                if (galRes.ok) {
                    const g = await galRes.json();
                    const persistedGallery: GalleryItem[] = Array.isArray(g.urls)
                        ? g.urls.map((url: string) => ({
                              id: url,
                              url,
                              persisted: true,
                          }))
                        : [];
                    setGallery(persistedGallery);
                    setRemovedGalleryUrls([]);
                    setInitialSnapshot({
                        role: prof.role ?? null,
                        about: prof.about ?? "",
                        goals: prof.role === "TRAINEE" ? (prof.goals ?? []) : [],
                        traineeTrainerStatus: prof.role === "TRAINEE" ? (prof.traineeTrainerStatus || "") : "",
                        traineeGymStatus: prof.role === "TRAINEE" ? (prof.traineeGymStatus || "") : "",
                        associatedTrainerId: prof.role === "TRAINEE" ? (prof.associatedTrainer?.id || "") : "",
                        associatedGymId:
                            prof.role === "TRAINEE"
                                ? prof.traineeGymPlaceId || prof.traineeGymName || ""
                                : prof.role === "TRAINER"
                                    ? prof.trainerGymPlaceId || prof.trainerGymName || ""
                                    : "",
                        associatedGymName:
                            prof.role === "TRAINEE"
                                ? (prof.traineeGymName || "")
                                : prof.role === "TRAINER"
                                    ? (prof.trainerGymName || "")
                                    : "",
                        services: prof.role === "TRAINER" ? (prof.services ?? []) : [],
                        hourlyRate:
                            prof.role === "TRAINER" && typeof prof.hourlyRate === "number" && !Number.isNaN(prof.hourlyRate)
                                ? prof.hourlyRate.toFixed(2)
                                : "0.00",
                        trainerGymStatus: prof.role === "TRAINER" ? (prof.trainerGymStatus || "") : "",
                        amenitiesText: prof.role === "GYM" ? (prof.amenitiesText ?? "") : "",
                        gymFee:
                            prof.role === "GYM" && typeof prof.gymFee === "number" && !Number.isNaN(prof.gymFee)
                                ? prof.gymFee.toFixed(2)
                                : "",
                        website:
                            prof.role === "GYM"
                                ? (prof.gymWebsite ?? "")
                                : prof.role === "TRAINER"
                                    ? (prof.website ?? "")
                                    : "",
                        showWebsiteButton:
                            prof.role === "GYM" || prof.role === "TRAINER"
                                ? Boolean(prof.showWebsiteButton)
                                : false,
                        hiringTrainers: prof.role === "GYM" ? Boolean(prof.hiringTrainers) : false,
                        galleryUrls: persistedGallery.map((item) => item.url),
                    });
                }
            } catch (e) {
                setErr("Failed to load.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggle = (value: string, list: string[], setList: (v: string[]) => void) => {
        const v = value.trim();
        if (!v) return;
        setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    };

    // Make onSave stable so useEffect can depend on it
    const onSave = useCallback(
        async (silent = false) => {
            try {
                if (role === "TRAINEE" && traineeTrainerStatus === "TRAINING_WITH" && !associatedTrainer) {
                    setTrainerFieldInvalid(true);
                    setErr("Select your trainer before saving.");
                    return;
                }
                if (role === "TRAINEE" && traineeGymStatus === "MEMBER" && !associatedGym) {
                    setGymFieldInvalid(true);
                    setErr("Select your gym before saving.");
                    return;
                }
                if (role === "TRAINER" && trainerGymStatus === "TRAINER" && !associatedGym) {
                    setTrainerGymFieldInvalid(true);
                    setErr("Select the gym you train at before saving.");
                    return;
                }
                if (!silent) {
                    setSaving(true);
                    setSavedState('saving');
                }
                setErr(null);

                const payload: any = { about };
                if (role === "TRAINEE") payload.goals = goals;
                if (role === "TRAINER") {
                    payload.services = services;
                    payload.hourlyRate = Number(hourlyRate);
                }
                if (role === "GYM") {
                    payload.amenitiesText = amenitiesText; // NEW
                }

                const requests: Promise<Response>[] = [
                    fetch("/api/user/search-profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    }),
                ];

                if (role === "TRAINEE" || role === "GYM" || role === "TRAINER") {
                    requests.push(
                        fetch("/api/user/profile", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                ...(role === "TRAINEE"
                                    ? {
                                          traineeTrainerStatus,
                                          traineeGymStatus,
                                          associatedTrainerId:
                                              traineeTrainerStatus === "TRAINING_WITH" ? associatedTrainer?.id ?? "" : "",
                                          associatedGymName: traineeGymStatus === "MEMBER" ? associatedGym?.name ?? "" : "",
                                          associatedGymPlaceId: traineeGymStatus === "MEMBER" ? associatedGym?.id ?? "" : "",
                                      }
                                    : {}),
                                ...(role === "GYM" || role === "TRAINER"
                                    ? {
                                          website,
                                          showWebsiteButton,
                                      }
                                    : {}),
                                ...(role === "GYM"
                                    ? {
                                          gymProfileFee: gymFee.trim() === "" ? 0 : Number(gymFee),
                                          hiringTrainers,
                                      }
                                    : {
                                          trainerGymStatus,
                                          associatedGymName: trainerGymStatus === "TRAINER" ? associatedGym?.name ?? "" : "",
                                          associatedGymPlaceId: trainerGymStatus === "TRAINER" ? associatedGym?.id ?? "" : "",
                                      }),
                            }),
                        })
                    );
                }

                const responses = await Promise.all(requests);
                if (responses.some((res) => !res.ok)) throw new Error();

                const pendingUploads = gallery.filter((item) => !item.persisted && item.file);
                const uploadedUrlsById = new Map<string, string>();

                if (pendingUploads.length > 0) {
                    const form = new FormData();
                    pendingUploads.forEach((item) => {
                        if (item.file) form.append("images", item.file);
                    });
                    const uploadRes = await fetch("/api/user/search-gallery", {
                        method: "POST",
                        body: form,
                    });
                    if (!uploadRes.ok) throw new Error();
                    const uploadData = await uploadRes.json();
                    const uploadedUrls = Array.isArray(uploadData.urls) ? uploadData.urls : [];
                    pendingUploads.forEach((item, index) => {
                        const nextUrl = uploadedUrls[index];
                        if (nextUrl) {
                            uploadedUrlsById.set(item.id, nextUrl);
                        }
                    });
                }

                if (removedGalleryUrls.length > 0) {
                    const deleteResponses = await Promise.all(
                        removedGalleryUrls.map((url) =>
                            fetch("/api/user/search-gallery", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ url }),
                            })
                        )
                    );
                    if (deleteResponses.some((res) => !res.ok)) throw new Error();
                }

                pendingUploads.forEach((item) => {
                    URL.revokeObjectURL(item.url);
                });

                const nextGalleryItems: GalleryItem[] = [];
                gallery.forEach((item) => {
                    if (!item.persisted) {
                        const uploadedUrl = uploadedUrlsById.get(item.id);
                        if (uploadedUrl) {
                            nextGalleryItems.push({
                                id: uploadedUrl,
                                url: uploadedUrl,
                                persisted: true,
                            });
                        }
                        return;
                    }

                    if (removedGalleryUrls.includes(item.url)) {
                        return;
                    }

                    nextGalleryItems.push(item);
                });

                setGallery(nextGalleryItems);
                setRemovedGalleryUrls([]);
                setInitialSnapshot({
                    role,
                    about,
                    goals,
                    traineeTrainerStatus,
                    traineeGymStatus,
                    associatedTrainerId: associatedTrainer?.id ?? "",
                    associatedGymId: associatedGym?.id ?? "",
                    associatedGymName: associatedGym?.name ?? "",
                    services,
                    hourlyRate,
                    trainerGymStatus,
                    amenitiesText,
                    gymFee,
                    website,
                    showWebsiteButton,
                    hiringTrainers,
                    galleryUrls: nextGalleryItems.map((item) => item.url),
                });
            } catch {
                setErr("Failed to save.");
            } finally {
                if (!silent) {
                    setSaving(false);
                    setSavedState('saved');
                    setTimeout(() => setSavedState('idle'), 2000);
                }
            }
        },
        [
            about,
            role,
            goals,
            traineeTrainerStatus,
            traineeGymStatus,
            associatedTrainer,
            services,
            hourlyRate,
            trainerGymStatus,
            associatedGym,
            amenitiesText,
            gymFee,
            website,
            showWebsiteButton,
            hiringTrainers,
            gallery,
            removedGalleryUrls,
        ],
    );

    const onUpload = (files: File[]) => {
        if (!files.length) return;
        setGallery((current) => [
            ...current,
            ...files.map((file) => ({
                id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                url: URL.createObjectURL(file),
                persisted: false,
                file,
            })),
        ]);
    };

    const onRemove = (item: GalleryItem) => {
        if (item.persisted) {
            setRemovedGalleryUrls((current) =>
                current.includes(item.url) ? current : [...current, item.url]
            );
        } else {
            URL.revokeObjectURL(item.url);
        }
        setGallery((current) => current.filter((entry) => entry.id !== item.id));
    };

    const roleCopy = useMemo(() => {
        if (role === "TRAINEE") return searchProfileCopy.TRAINEE;
        if (role === "TRAINER") return searchProfileCopy.TRAINER;
        if (role === "GYM") return searchProfileCopy.GYM;
        return null;
    }, [role]);

    const isDirty = useMemo(() => {
        if (!initialSnapshot) return false;

        const persistedGalleryUrls = gallery
            .filter((item) => item.persisted)
            .map((item) => item.url);
        const hasPendingUploads = gallery.some((item) => !item.persisted);

        return (
            initialSnapshot.role !== role ||
            initialSnapshot.about !== about ||
            JSON.stringify(initialSnapshot.goals) !== JSON.stringify(goals) ||
            initialSnapshot.traineeTrainerStatus !== traineeTrainerStatus ||
            initialSnapshot.traineeGymStatus !== traineeGymStatus ||
            initialSnapshot.associatedTrainerId !== (associatedTrainer?.id ?? "") ||
            JSON.stringify(initialSnapshot.services) !== JSON.stringify(services) ||
            initialSnapshot.hourlyRate !== hourlyRate ||
            initialSnapshot.trainerGymStatus !== trainerGymStatus ||
            initialSnapshot.associatedGymId !== (associatedGym?.id ?? "") ||
            initialSnapshot.associatedGymName !== (associatedGym?.name ?? "") ||
            initialSnapshot.amenitiesText !== amenitiesText ||
            initialSnapshot.gymFee !== gymFee ||
            initialSnapshot.website !== website ||
            initialSnapshot.showWebsiteButton !== showWebsiteButton ||
            initialSnapshot.hiringTrainers !== hiringTrainers ||
            JSON.stringify(initialSnapshot.galleryUrls) !== JSON.stringify(persistedGalleryUrls) ||
            removedGalleryUrls.length > 0 ||
            hasPendingUploads
        );
    }, [
        initialSnapshot,
        role,
        about,
        goals,
        traineeTrainerStatus,
        traineeGymStatus,
        associatedTrainer,
        services,
        hourlyRate,
        trainerGymStatus,
        associatedGym,
        amenitiesText,
        gymFee,
        website,
        showWebsiteButton,
        hiringTrainers,
        gallery,
        removedGalleryUrls,
    ]);

    useEffect(() => {
        return () => {
            gallery.forEach((item) => {
                if (!item.persisted) {
                    URL.revokeObjectURL(item.url);
                }
            });
        };
    }, [gallery]);

    // Watch the external trigger from the parent and run onSave whenever it changes
    const lastTriggerRef = useRef<number | undefined>(externalSaveTrigger);
    useEffect(() => {
        if (externalSaveTrigger === undefined) return;

        if (lastTriggerRef.current === undefined) {
            lastTriggerRef.current = externalSaveTrigger;
            return;
        }

        if (externalSaveTrigger !== lastTriggerRef.current) {
            lastTriggerRef.current = externalSaveTrigger;
            // Trigger a save of the Search Profile silently
            onSave(true);
        }
    }, [externalSaveTrigger, onSave]);

    return (
        <section className={clsx("min-w-0", className)}>
            {roleCopy && (
                <>
                    <h2 className="mb-2 text-lg font-semibold tracking-tight text-gray-950 dark:text-white">
                        {roleCopy.title}
                    </h2>
                    <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">{roleCopy.description}</p>
                </>
            )}

            {loading ? (
                <div className="text-gray-500">Loading…</div>
            ) : (
                <>
                    {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

                    {/* About */}
                    <div className="mb-6">
                        <label className="mb-1 block text-sm font-medium">{roleCopy?.aboutLabel}</label>
                        <textarea
                            className="w-full min-h-[100px] border rounded-md px-3 py-2 text-sm outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/20 dark:text-gray-100"
                            placeholder={roleCopy?.aboutPlaceholder}
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                        />
                    </div>

                    {/* Role-specific fields */}
                    {role === "TRAINEE" && (
                        <TraineeSearchProfileFields
                            goals={goals}
                            choices={traineeChoices}
                            onToggleGoal={(goal) => toggle(goal, goals, setGoals)}
                            traineeTrainerStatus={traineeTrainerStatus}
                            traineeGymStatus={traineeGymStatus}
                            associatedTrainer={associatedTrainer}
                            associatedGym={associatedGym}
                            trainerInvalid={trainerFieldInvalid}
                            gymInvalid={gymFieldInvalid}
                            onTrainerStatusChange={(value) => {
                                setTraineeTrainerStatus(value);
                                setTrainerFieldInvalid(false);
                                if (value !== "TRAINING_WITH") {
                                    setAssociatedTrainer(null);
                                }
                            }}
                            onGymStatusChange={(value) => {
                                setTraineeGymStatus(value);
                                setGymFieldInvalid(false);
                                if (value !== "MEMBER") {
                                    setAssociatedGym(null);
                                }
                            }}
                            onAssociatedTrainerChange={(trainer) => {
                                setAssociatedTrainer(trainer);
                                if (trainer) {
                                    setTrainerFieldInvalid(false);
                                }
                            }}
                            onAssociatedGymChange={(gym) => {
                                setAssociatedGym(gym);
                                if (gym) {
                                    setGymFieldInvalid(false);
                                }
                            }}
                        />
                    )}

                    {role === "TRAINER" && (
                        <TrainerSearchProfileFields
                            services={services}
                            choices={trainerChoices}
                            hourlyRate={hourlyRate}
                            trainerGymStatus={trainerGymStatus}
                            associatedGym={associatedGym}
                            showWebsiteButton={showWebsiteButton}
                            website={website}
                            onToggleService={(service) => toggle(service, services, setServices)}
                            onHourlyRateChange={(value) => setHourlyRate(normalizeCurrencyValue(value))}
                            onHourlyRateBlur={() => {
                                if (hourlyRate.trim() === "") {
                                    setHourlyRate("0.00");
                                    return;
                                }
                                const numeric = Number(hourlyRate);
                                if (Number.isFinite(numeric)) {
                                    setHourlyRate(numeric.toFixed(2));
                                }
                            }}
                            onTrainerGymStatusChange={(value) => {
                                setTrainerGymStatus(value);
                                setTrainerGymFieldInvalid(false);
                                if (value !== "TRAINER") {
                                    setAssociatedGym(null);
                                }
                            }}
                            onAssociatedGymChange={(gym) => {
                                setAssociatedGym(gym);
                                if (gym) {
                                    setTrainerGymFieldInvalid(false);
                                }
                            }}
                            associatedGymInvalid={trainerGymFieldInvalid}
                            onWebsiteChange={setWebsite}
                            onToggleShowWebsite={() => setShowWebsiteButton((current) => !current)}
                        />
                    )}

                    {role === "GYM" && (
                        <GymSearchProfileFields
                            amenitiesText={amenitiesText}
                            gymFee={gymFee}
                            website={website}
                            showWebsiteButton={showWebsiteButton}
                            hiringTrainers={hiringTrainers}
                            onAmenitiesChange={setAmenitiesText}
                            onGymFeeChange={(value) => setGymFee(normalizeCurrencyValue(value))}
                            onGymFeeBlur={() => {
                                if (gymFee.trim() === "") return;
                                const numeric = Number(gymFee);
                                if (Number.isFinite(numeric)) {
                                    setGymFee(numeric.toFixed(2));
                                }
                            }}
                            onWebsiteChange={setWebsite}
                            onToggleShowWebsite={() => setShowWebsiteButton((current) => !current)}
                            onToggleHiringTrainers={() => setHiringTrainers((current) => !current)}
                        />
                    )}

                    {/* Uploaded Images */}
                    <div className="mb-6">
                        <div className="mb-2">
                            <label className="block text-sm font-medium">{roleCopy?.imagesLabel}</label>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                const valid = files.filter(
                                    (f) => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024
                                );
                                onUpload(valid);
                                if (fileRef.current) fileRef.current.value = "";
                            }}
                        />
                        {gallery.length === 0 ? (
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="mb-3 flex w-full flex-col items-center justify-center rounded-lg border border-dashed py-6 transition hover:bg-zinc-50 dark:border-white/20 dark:hover:bg-white/5"
                            >
                                <ImageIcon className="mb-2 h-5 w-5 text-zinc-500 dark:text-gray-300" />
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {roleCopy?.imagesEmpty}
                                </span>
                            </button>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {gallery.map((item) => (
                                    <div key={item.id} className="relative group border rounded-lg overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                                        <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                                        <button
                                            type="button"
                                            onClick={() => onRemove(item)}
                                            className="absolute top-2 right-2 rounded-full bg-red-600 p-1.5 text-white opacity-100 transition hover:bg-red-700 sm:bg-black/70 sm:opacity-0 sm:hover:bg-red-600 sm:group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border border-dashed transition hover:bg-zinc-50 dark:border-white/20 dark:hover:bg-white/5"
                                    title={roleCopy?.uploadLabel}
                                >
                                    <Plus className="mb-1 h-5 w-5 text-zinc-500 dark:text-gray-300" />
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                        {roleCopy?.uploadLabel}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                            onClick={() => onSave()}
                            disabled={saving || (!isDirty && savedState === 'idle')}
                            className={clsx(
                                "w-full rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 sm:w-auto",
                                savedState === 'saved'
                                    ? "bg-green-700 text-white hover:bg-green-800 dark:bg-green-500 dark:text-black dark:hover:bg-green-400"
                                    : saving
                                        ? "bg-gray-300 text-gray-600 dark:bg-white/10 dark:text-gray-400"
                                        : isDirty
                                            ? "bg-green-700 text-white hover:bg-green-800 dark:bg-green-500 dark:text-black dark:hover:bg-green-400"
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                            )}
                        >
                            {savedState === 'saved' ? 'Saved!' : savedState === 'saving' ? 'Saving…' : 'Save changes'}
                        </button>
                        {err && <span className="text-sm text-red-600 sm:w-auto">{err}</span>}
                    </div>
                </>
            )}
        </section>
    );
}
