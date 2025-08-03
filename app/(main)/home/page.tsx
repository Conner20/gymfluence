// import { authOptions } from "@/lib/auth";
// import { getServerSession } from "next-auth";

export default async function Home() {
    // const session = await getServerSession(authOptions);

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="w-full bg-white py-6 flex justify-center items-center z-20">
                <h1 className="font-serif font-bold text-3xl text-green-700 tracking-tight select-none">
                    <span>gymfluence</span>
                </h1>
            </header>
        </div>
    );
}
