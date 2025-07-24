import Navbar from "@/components/Navbar";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

const page = async () => {
    const session = await getServerSession(authOptions);

    if(session?.user) {
        return (
            <main className='h-screen flex flex-col justify-center items-center'>
                <Navbar />
                <h2 className='text-2xl'>Admin page - welcome back {session?.user.username || session.user.name}</h2>
            </main>
        )
    }

    return (
        <main className='h-screen flex flex-col justify-center items-center'>
            <Navbar />
            <h2 className='text-2xl'>Please login to see this admin page</h2>
        </main>
    )
};

export default page;