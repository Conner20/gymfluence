'use client';

import HomePosts from "@/components/HomePosts";
import PageShell from "@/components/PageShell";

type HomePageShellProps = {
    posts: any;
};

export default function HomePageShell({ posts }: HomePageShellProps) {
    return (
        <PageShell title="gymfluence" href="/" mainClassName="flex justify-center px-4 sm:px-6">
            <div className="w-full max-w-3xl">
                <HomePosts initialPosts={posts} />
            </div>
        </PageShell>
    );
}
