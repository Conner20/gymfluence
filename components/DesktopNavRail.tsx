import Link from "next/link";
import { navItems } from "@/components/Navbar";
import { usePathname } from "next/navigation";

export default function DesktopNavRail() {
    const pathname = usePathname();

    return (
        <div className="hidden lg:flex">
            <nav className="sticky top-0 h-screen w-20 bg-white flex flex-col items-center z-40">
                <div className="flex flex-col justify-center items-center gap-8 h-full w-full">
                    {navItems.map((item, idx) => {
                        const isActive = pathname === item.href;
                        if (item.type === "modal") return null;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`p-2 rounded-xl flex items-center justify-center transition ${
                                    isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                                }`}
                                title={item.label}
                            >
                                {item.icon(isActive)}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
