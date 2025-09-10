// app/(main)/post/[id]/page.tsx
import PostDetail from "@/components/PostDetail";

export const revalidate = 0;

export default function PostPage({ params }: { params: { id: string } }) {
    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <main className="mx-auto w-full max-w-[1200px] lg:max-w-[1320px] px-4 sm:px-6 lg:px-10 py-6">
                <PostDetail postId={params.id} />
            </main>
        </div>
    );
}
