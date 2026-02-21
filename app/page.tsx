// app/(main)/landing/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Instagram, Linkedin, Facebook, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === "dark";

  return (
      <div className="min-h-screen bg-white text-black transition-colors dark:bg-[#050505] dark:text-white">
      {/* ======= NAV ======= */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-green-700 dark:text-green-400">
            <span>fitt</span>
            <span className="underline decoration-2 decoration-green-700 underline-offset-[2px] dark:decoration-green-400">in</span>
            <span>g</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/log-in"
              className="px-4 py-2 rounded-full border transition hover:bg-black hover:text-white dark:border-white/25 dark:text-white dark:hover:bg-white/10"
            >
              log in
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 rounded-full bg-green-700 text-white transition hover:bg-black dark:bg-green-600 dark:hover:bg-white/10"
            >
              sign up
            </Link>
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-black hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white/10"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </div>
      </header>

      {/* ======= HERO ======= */}
      <section className="relative overflow-hidden">
        {/* subtle background glows */}

        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 pb-8 pt-16 sm:px-6 lg:pb-12 lg:pt-28">
          <div className="w-full max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
              <span className="block">Empower Trainers.</span>
              <span className="block">Elevate Gyms.</span>
              <span className="block">Transform Clients.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-neutral-700 max-w-xl mx-auto px-1 dark:text-neutral-300">
              A shared ecosystem for gyms, trainers, and fitness enthusiasts.
              Fitting In helps you connect, track, and train — all in one place.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-700 text-white hover:bg-black transition dark:bg-green-600 dark:hover:bg-white/10"
              >
                Get Started <ArrowRight size={18} />
              </Link>
            </div>

            <p className="mt-8 text-sm uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Re-engineering the Fitness Economy.
            </p>
          </div>
        </div>

        {/* divider */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </section>

      {/* ======= VALUE STRIP ======= */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10 text-center">
        <p className="text-lg md:text-xl text-neutral-700 dark:text-neutral-300">
          Share results. Build a client base. Create a business.
        </p>
      </section>

      {/* ======= FEATURE: CONNECT ======= */}
      <FeatureSection
        eyebrow="Connect"
        title="Connect and grow with gyms, trainers, and fitness enthusiasts."
        body="Discover people nearby, follow private or public profiles, and build your network with smart search and filters."
        imageSrc={darkMode ? "/images/search_dark.png" : "/images/search.png"} // Replace with your Search page screenshot
        imageAlt="Search & connect"
        // slightly wider & more cinematic for this screenshot
        frameClassName="max-w-[740px] aspect-[15/9]"
        imageClassName="object-contain"
      />

      {/* ======= FEATURE: TRACK ======= */}
      <FeatureSection
        inverted
        eyebrow="Track"
        title="Dashboards that make progress obvious."
        body="Visualize metrics that matter, stay accountable with ratings & reviews, and see the bigger picture at a glance."
        imageSrc={darkMode ? "/images/dashboard_dark.png" : "/images/dashboard.png"} // Replace with your Dashboard screenshot
        imageAlt="Analytics dashboard"
        frameClassName="max-w-[740px] aspect-[13/10]"
        imageClassName="object-contain"
      />

      {/* ======= FEATURE: TRAIN ======= */}
      <FeatureSection
        eyebrow="Train"
        title="Programs, posts, and real results."
        body="Publish sessions, share media, and cultivate community. Everything you need to train smarter — together."
        imageSrc={darkMode ? "/images/home_dark.png" : "/images/home.png"} // Replace with your Home/Posts screenshot
        imageAlt="Home posts feed"
        frameClassName="max-w-[720px] aspect-[14/9]"
        imageClassName="object-contain"
      />

      {/* ======= CTA ======= */}
      <section className="bg-black text-white dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">
            Fit in today.
          </h2>
          <p className="mt-3 text-neutral-300">
            Connect • Track • Train — all in one platform.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-green-700 hover:text-white transition dark:hover:bg-green-600"
            >
              Get Started <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            <span>fitt</span>
            <span className="underline decoration-2 decoration-neutral-600 underline-offset-[2px] dark:decoration-neutral-400">in</span>
            <span>g</span>
          </span>
          {/* <div className="flex items-center gap-4 text-sm">
            <Link href="/"><Facebook /></Link>
            <Link href="/"><Instagram /></Link>
            <Link href="/"><Linkedin /></Link>
          </div> */}
        </div>
      </footer>
      </div>
  );
}

/* ========================================================================== */
/* ================================ PARTIALS =================================*/
/* ========================================================================== */

function DeviceCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[640px] aspect-[16/10] rounded-[24px] border bg-white/70 shadow-xl ring-1 ring-black/5 overflow-hidden dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
      {/* faux status bar */}
      <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-black/5 to-transparent z-10" />
      {/* media */}
      <div className="absolute inset-0">{children}</div>
      {/* preview overlay removed */}
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 md:py-14">
        <div
          className={[
            "grid gap-8 items-center",
            "lg:grid-cols-2",
            inverted ? "lg:[&>div:first-child]:order-2" : "",
          ].join(" ")}
        >
          {/* text */}
          <div className="text-center lg:text-left px-2">
            <div className="text-xs sm:text-sm font-medium text-green-700 uppercase tracking-wider dark:text-green-400">
              {eyebrow}
            </div>
            <h3 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{title}</h3>
            <p className="mt-4 text-base sm:text-lg text-neutral-700 max-w-xl mx-auto lg:mx-0 dark:text-neutral-300">
              {body}
            </p>
          </div>

          {/* image */}
          <div className="relative w-full flex justify-center">
            <div
              className={[
                "relative mx-auto w-full rounded-[20px] border bg-white shadow-lg ring-1 ring-black/5 overflow-hidden dark:border-white/10 dark:bg-[#181818] dark:ring-white/10",
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
            <div className="pointer-events-none absolute -z-10 -inset-4 rounded-[28px] bg-green-700/5 blur-2xl dark:bg-white/10" />
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
