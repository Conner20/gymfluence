// app/(main)/post/[id]/page.tsx
import PostDetail from "@/components/PostDetail";

export const revalidate = 0;

export default function PostPage({ params }: { params: { id: string } }) {
    return (
        <div className="min-h-screen bg-white">
            <main className="w-full flex justify-center py-6">
                <PostDetail postId={params.id} />
            </main>
        </div>
    );
}
