// app/(main)/landing/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, Dumbbell, UserRound } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import LandingHeader from "@/components/LandingHeader";

export default function LandingPage() {
  const { theme } = useTheme();
  const darkMode = theme === "dark";

  return (
    <div className="min-h-screen bg-white text-black transition-colors dark:bg-[#050505] dark:text-white">
      {/* ======= NAV ======= */}
      <LandingHeader />

      {/* ======= HERO ======= */}
      <section className="relative overflow-hidden">
        {/* gentle top fade / glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-20 bg-gradient-to-b to-transparent dark:from-white/4 dark:via-white/1 sm:h-24 lg:h-28" />

        <div className="relative z-10 mx-auto flex min-h-[68vh] max-w-7xl items-center justify-center px-4 pb-14 pt-20 sm:px-6 sm:pb-16 sm:pt-24 lg:min-h-[74vh] lg:pb-20 lg:pt-28">
          <div className="w-full max-w-5xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-green-700 dark:text-green-400 sm:text-base">
              Find your fit
            </p>

            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-7xl">
              The fitness marketplace built to help you grow
            </h1>

            <p className="mx-auto mt-6 max-w-3xl px-1 text-base text-neutral-700 dark:text-neutral-300 sm:text-lg md:text-xl">
              Build your network. Unlock opportunity.{" "}
              <span className="inline-block whitespace-nowrap">Reach your goals.</span>
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full bg-green-700 px-7 py-3.5 text-white transition hover:bg-black dark:bg-green-600 dark:hover:bg-white/10"
              >
                Get Started <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>

        {/* divider */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </section>

      {/* ======= ROLES ======= */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
        <div className="grid items-stretch gap-5 md:grid-cols-3 lg:gap-6">
          <RoleCard
            title="Gyms"
            icon={<Building2 className="h-5 w-5" />}
            bullets={[
              "Attract more clients",
              "Recruit trainers",
              "Grow your business",
            ]}
          />
          <RoleCard
            title="Trainers"
            icon={<Dumbbell className="h-5 w-5" />}
            bullets={[
              "Expand your client base",
              "Build your brand",
              "Connect with gyms",
            ]}
          />
          <RoleCard
            title="Trainees"
            icon={<UserRound className="h-5 w-5" />}
            bullets={[
              "Find the right personal trainer",
              "Track and share your progress",
              "Discover a gym that fits your goals",
            ]}
          />
        </div>
      </section>

      {/* ======= FEATURE: CONNECT ======= */}
      <FeatureSection
        eyebrow="Discover"
        title="Find your fit faster."
        body="Search by role, distance, budget, and goals to find better matches."
        imageSrc={darkMode ? "/images/search_dark.png" : "/images/search.png"}
        imageAlt="Search and connect"
        frameClassName="max-w-[740px] aspect-[15/9]"
        imageClassName="object-contain"
      />

      {/* ======= FEATURE: TRACK ======= */}
      <FeatureSection
        inverted
        eyebrow="Track"
        title="See progress at a glance."
        body="Track workouts, wellness, and nutrition in one place with visual dashboards."
        imageSrc={darkMode ? "/images/dashboard_dark.png" : "/images/dashboard.png"}
        imageAlt="Analytics dashboard"
        frameClassName="max-w-[740px] aspect-[13/10]"
        imageClassName="object-contain"
      />

      {/* ======= FEATURE: TRAIN ======= */}
      <FeatureSection
        eyebrow="Post"
        title="Share what you’re building."
        body="From personal progress to business growth, share updates that build trust and connection."
        imageSrc={darkMode ? "/images/home_dark.png" : "/images/home.png"}
        imageAlt="Home posts feed"
        frameClassName="max-w-[720px] aspect-[14/9]"
        imageClassName="object-contain"
      />

      {/* ======= CTA ======= */}
      <section className="bg-black text-white dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold md:text-4xl">Where growth begins</h2>
          <p className="mt-3 text-neutral-300">Take your next step with Fitting In.</p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-black transition hover:bg-green-700 hover:text-white dark:hover:bg-green-600"
            >
              Get Started <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            <span>fitt</span>
            <span className="underline decoration-2 decoration-neutral-600 underline-offset-[2px] dark:decoration-neutral-400">
              in
            </span>
            <span>g</span>
          </span>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
            <Link href="/legal/terms" className="transition hover:text-black dark:hover:text-white">
              Terms
            </Link>
            <Link href="/legal/privacy" className="transition hover:text-black dark:hover:text-white">
              Privacy
            </Link>
            <Link href="/legal/support" className="transition hover:text-black dark:hover:text-white">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ========================================================================== */
/* ================================ PARTIALS =================================*/
/* ========================================================================== */

function RoleCard({
  title,
  icon,
  bullets,
}: {
  title: string;
  icon: React.ReactNode;
  bullets: string[];
}) {
  return (
    <div className="h-full rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm ring-1 ring-black/5 transition dark:border-white/10 dark:bg-[#111111] dark:ring-white/10 sm:p-7">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100">
          {icon}
        </div>
        <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h3>
      </div>

      <ul className="mt-5 space-y-3.5 text-[15px] leading-6 text-neutral-700 dark:text-neutral-300 sm:text-base sm:leading-7">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-green-700 dark:bg-green-400" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureSection({
  eyebrow,
  title,
  body,
  imageSrc,
  imageAlt,
  inverted = false,
  frameClassName,
  imageClassName,
}: {
  eyebrow: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  inverted?: boolean;
  frameClassName?: string;
  imageClassName?: string;
}) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
        <div
          className={[
            "grid items-center gap-8 lg:grid-cols-2",
            inverted ? "lg:[&>div:first-child]:order-2" : "",
          ].join(" ")}
        >
          {/* text */}
          <div className="px-2 text-center lg:text-left">
            <div className="text-xs font-medium uppercase tracking-wider text-green-700 dark:text-green-400 sm:text-sm">
              {eyebrow}
            </div>
            <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{title}</h3>
            <p className="mx-auto mt-4 max-w-xl text-base text-neutral-700 dark:text-neutral-300 sm:text-lg lg:mx-0">
              {body}
            </p>
          </div>

          {/* image */}
          <div className="relative flex w-full justify-center">
            <div
              className={[
                "relative mx-auto w-full overflow-hidden rounded-[20px] border bg-white shadow-lg ring-1 ring-black/5 dark:border-white/10 dark:bg-[#181818] dark:ring-white/10",
                frameClassName ?? "max-w-[720px] aspect-[16/10]",
              ].join(" ")}
            >
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                className={imageClassName ?? "object-contain"}
              />
            </div>

            {/* soft glow */}
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[28px] bg-green-700/5 blur-2xl dark:bg-white/10" />
          </div>
        </div>
      </div>

      {/* divider */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </section>
  );
}
