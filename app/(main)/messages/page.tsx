import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Messenger from "@/components/Messenger";
import Navbar from "@/components/Navbar";

export default async function Messages() {
    const session = await getServerSession(authOptions);
    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                    <span>messenger</span>
                </h1>
            </header>
            <main className="flex justify-center px-4 py-6">
                <Messenger />
            </main>
            <Navbar />
        </div>
        
        
    );
}
