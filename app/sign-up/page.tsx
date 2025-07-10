import Link from "@/node_modules/next/link";

export default function SignUpPage() {
    return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-start">
            {/* Logo */}
            <div className="mt-24 mb-8 text-5xl font-bold select-none text-center">
                <span className="text-green-700">gymfluence</span>
            </div>
            {/* Card */}
            <div className="bg-white px-12 py-10 rounded-xl shadow-md w-full max-w-md flex flex-col items-center">
                <h1 className="text-4xl font-normal mb-7 text-center text-black">sign up</h1>
                <form className="w-full flex flex-col gap-4">
                    {/* Name */}
                    <label className="text-left text-base font-normal text-black">
                        Name
                        <input
                            type="text"
                            className="w-full mt-1 mb-2 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-700 transition text-black"
                        />
                    </label>
                    {/* Email */}
                    <label className="text-left text-base font-normal text-black">
                        Email
                        <input
                            type="email"
                            className="w-full mt-1 mb-2 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-700 transition text-black"
                        />
                    </label>
                    {/* Password */}
                    <label className="text-left text-base font-normal text-black">
                        Password
                        <input
                            type="password"
                            className="w-full mt-1 mb-2 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-700 transition text-black"
                        />
                    </label>
                    {/* City Location */}
                    <label className="text-left text-base font-normal text-black">
                        City Location
                        <input
                            type="text"
                            className="w-full mt-1 mb-4 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-700 transition text-black"
                        />
                    </label>
                    {/* Create Account Button */}
                    <button
                        type="submit"
                        className="w-full bg-green-700 text-white py-2 rounded-md font-normal text-base hover:bg-green-800 transition mb-1"
                    >
                        Create Account
                    </button>
                </form>
                {/* Log in Button */}
                <Link
                    href="/log-in"
                    className="w-full border border-gray-400 text-green-700 text-base rounded-md py-2 mt-2 text-center hover:bg-gray-100 transition"
                >
                    Log in
                </Link>
            </div>
        </div>
    );
}