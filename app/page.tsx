// app/(main)/landing/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play, Instagram, Linkedin, Facebook } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* ======= NAV ======= */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Replace with your real logo image */}
            <div className="relative h-10 w-10 rounded-full ring-black/10 overflow-hidden">
              <Image src="/logo.svg" alt="gymfluence logo" fill className="object-contain p-1" />
            </div>
            <Link href="/" className="text-2xl font-semibold tracking-tight">
              <span className="text-green-700">gymfluence</span>
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/log-in"
              className="px-4 py-2 rounded-full border hover:bg-black hover:text-white transition"
            >
              log in
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 rounded-full bg-green-700 text-white hover:bg-black transition"
            >
              sign up
            </Link>
          </nav>
        </div>
      </header>

      {/* ======= HERO ======= */}
      <section className="relative overflow-hidden">
        {/* subtle background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-green-700/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-black/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-20 pb-8 lg:pt-28 lg:pb-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
              <span className="block">Empower Trainers.</span>
              <span className="block">Elevate Gyms.</span>
              <span className="block">Transform Clients.</span>
            </h1>
            <p className="mt-6 text-lg text-neutral-700 max-w-xl">
              A shared ecosystem for gyms, trainers, and fitness enthusiasts.
              Gymfluence helps you connect, track, and train — all in one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-700 text-white hover:bg-black transition"
              >
                Get Started <ArrowRight size={18} />
              </Link>
            </div>

            <p className="mt-8 text-sm uppercase tracking-wider text-neutral-500">
              Re-engineering the Fitness Economy.
            </p>
          </div>

          {/* HERO SHOWCASE — drop your brand mark here if you prefer */}
          <div className="relative">
            <DeviceCard>
              {/* Replace src with your hero screenshot (e.g., a collage) */}
              <Image
                src="/images/hero-showcase.png"
                alt="Gymfluence overview"
                fill
                className="object-cover"
                priority
              />
            </DeviceCard>

            {/* floating logo tile (optional) */}
            <div className="hidden md:block absolute -left-6 -bottom-6">
              <div className="rounded-2xl border bg-white shadow-sm p-3">
                <div className="relative h-10 w-10">
                  <Image src="/logo.svg" alt="logo" fill className="object-contain" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* divider */}
        <div className="mx-auto max-w-7xl px-6">
          <div className="h-px w-full bg-neutral-200" />
        </div>
      </section>

      {/* ======= VALUE STRIP ======= */}
      <section className="mx-auto max-w-7xl px-6 py-10 text-center">
        <p className="text-[1.15rem] md:text-xl text-neutral-700">
          Share results. Build a client base. Create a business.
        </p>
      </section>

      {/* ======= FEATURE: CONNECT ======= */}
      <FeatureSection
        eyebrow="Connect"
        title="Connect and grow with gyms, trainers, and fitness enthusiasts."
        body="Discover people nearby, follow private or public profiles, and build your network with smart search and filters."
        imageSrc="/images/search.png" // Replace with your Search page screenshot
        imageAlt="Search & connect"
      />

      {/* ======= FEATURE: TRACK ======= */}
      <FeatureSection
        inverted
        eyebrow="Track"
        title="Dashboards that make progress obvious."
        body="Visualize metrics that matter, stay accountable with ratings & reviews, and see the bigger picture at a glance."
        imageSrc="/images/dashboard.png" // Replace with your Dashboard screenshot
        imageAlt="Analytics dashboard"
      />

      {/* ======= FEATURE: TRAIN ======= */}
      <FeatureSection
        eyebrow="Train"
        title="Programs, posts, and real results."
        body="Publish sessions, share media, and cultivate community. Everything you need to train smarter — together."
        imageSrc="/images/home.png" // Replace with your Home/Posts screenshot
        imageAlt="Home posts feed"
      />

      {/* ======= CTA ======= */}
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">
            Become a Gymfluencer today.
          </h2>
          <p className="mt-3 text-neutral-300">
            Connect • Track • Train — all in one platform.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-green-700 hover:text-white transition"
            >
              Get Started <ArrowRight size={18} />
            </Link>
            <Link
              href="/log-in"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 text-white hover:bg-white hover:text-black transition"
            >
              log in
            </Link>
          </div>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-6 w-6 rounded-full ring-1 ring-black/10 overflow-hidden">
              <Image src="/logo.svg" alt="gymfluence" fill className="object-contain p-0.5" />
            </div>
            <span className="text-sm text-neutral-600">
              Copyright © {new Date().getFullYear()} Gymfluence, Inc. All Rights Reserved.
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/"><Facebook /></Link>
            <Link href="/"><Instagram /></Link>
            <Link href="/"><Linkedin /></Link>
          </div>
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
    <div className="relative mx-auto w-full max-w-[640px] aspect-[16/10] rounded-[24px] border bg-white/70 shadow-xl ring-1 ring-black/5 overflow-hidden">
      {/* faux status bar */}
      <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-black/5 to-transparent z-10" />
      {/* media */}
      <div className="absolute inset-0">{children}</div>
      {/* play overlay (optional / decorative) */}
      <button
        className="group absolute bottom-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs backdrop-blur hover:bg-green-700 transition"
        aria-label="Preview"
      >
        <Play size={14} className="opacity-90 group-hover:opacity-100" />
        Preview
      </button>
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
}: {
  eyebrow: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  inverted?: boolean;
}) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div
          className={[
            "grid gap-10 items-center",
            "lg:grid-cols-2",
            inverted ? "lg:[&>div:first-child]:order-2" : "",
          ].join(" ")}
        >
          {/* text */}
          <div>
            <div className="text-sm font-medium text-green-700 uppercase tracking-wider">
              {eyebrow}
            </div>
            <h3 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{title}</h3>
            <p className="mt-4 text-lg text-neutral-700 max-w-xl">{body}</p>
          </div>

          {/* image */}
          <div className="relative">
            <div className="relative mx-auto w-full max-w-[720px] aspect-[16/10] rounded-[20px] border bg-white shadow-lg ring-1 ring-black/5 overflow-hidden">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                className="object-cover"
              />
            </div>
            {/* soft glow */}
            <div className="pointer-events-none absolute -z-10 -inset-4 rounded-[28px] bg-green-700/5 blur-2xl" />
          </div>
        </div>
      </div>

      {/* divider */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="h-px w-full bg-neutral-200" />
      </div>
    </section>
  );
}
