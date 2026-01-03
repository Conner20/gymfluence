'use client';

import MobileHeader from "@/components/MobileHeader";
import HomePosts from "@/components/HomePosts";

type HomePageShellProps = {
    posts: any;
};

export default function HomePageShell({ posts }: HomePageShellProps) {
    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
            <MobileHeader title="gymfluence" href="/" />

            <header className="hidden lg:flex w-full bg-white py-5 px-6 items-center justify-center">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                    gymfluence
                </h1>
            </header>

            <main className="flex-1 w-full flex justify-center px-4 sm:px-6">
                <div className="w-full max-w-3xl">
                    <HomePosts initialPosts={posts} />
                </div>
            </main>
        </div>
    );
}
