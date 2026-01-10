import Link from "next/link";
import LogInForm from "@/components/form/LogInForm";

const page = () => {
    return (
        <div className="min-h-screen w-full bg-neutral-50 px-4 py-10 flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-100">
                <LogInForm />
                <div className="text-center">
                    <Link
                        href="/"
                        className="text-sm text-zinc-500 transition hover:text-zinc-800"
                    >
                        ← Back
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default page;
