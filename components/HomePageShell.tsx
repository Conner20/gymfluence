'use client';

import HomePosts from "@/components/HomePosts";
import PageShell from "@/components/PageShell";

type HomePageShellProps = {
    posts: any;
};

export default function HomePageShell({ posts }: HomePageShellProps) {
    return (
        <PageShell title="gymfluence" href="/" mainClassName="flex justify-center px-4 sm:px-6">
            <div className="hidden lg:block w-full bg-white py-5 px-6 mb-4">
                <h1 className="font-serif font-bold text-3xl text-green-700 tracking-tight select-none">
                    gymfluence
                </h1>
            </div>
            <div className="w-full max-w-3xl">
                <HomePosts initialPosts={posts} />
            </div>
        </PageShell>
    );
}
