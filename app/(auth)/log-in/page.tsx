import Link from "next/link";
import LogInForm from "@/components/form/LogInForm";

const page = () => {
    return (
        <div className="bg-slate-200 p-10 rounded-md w-full max-w-md space-y-4">
            <LogInForm />
            <div className="text-center">
                <Link
                    href="/"
                    className="inline-flex items-center text-sm text-green-700 hover:text-green-900 transition-colors"
                >
                    Back
                </Link>
            </div>
        </div>
    )
}

export default page;
