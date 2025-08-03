import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export default async function Profile() {
    const session = await getServerSession(authOptions);

    if (session?.user) {
        return <div className="min-h-screen bg-[#f8f8f8]">
            <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                    <span>{session?.user.username}</span>
                </h1>
            </header>
        </div>
    }
    return <div className="min-h-screen bg-[#f8f8f8]">
        <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
            <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                <span>profile</span>
            </h1>
        </header>
    </div>

}