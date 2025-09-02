import PrivacyToggle from "./privacy-toggle";
import Navbar from "@/components/Navbar";

export default async function Settings() {
    return <div className="min-h-screen bg-[#f8f8f8]">
        <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
            <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                <span>settings</span>
            </h1>
        </header>

        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-semibold mb-4">Settings</h1>
            <PrivacyToggle />
        </div>
        <Navbar />
    </div>
}