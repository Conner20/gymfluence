import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import MessengerPageShell from "@/components/MessengerPageShell";

export default async function Messages() {
    const session = await getServerSession(authOptions);
    return (
        <MessengerPageShell />
    );
}
