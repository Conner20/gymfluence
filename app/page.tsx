import Link from "@/node_modules/next/link";
import FormPost from "./Form";

  async function getPosts() {
    const res = await fetch(`${process.env.BASE_URL}/api/getPosts`)
    if(!res.ok) {
      console.log(res)
    }
    return res.json();
  }

export default async function LandingPage() {
    const data : { id: number; title: string; userId: number }[] = await getPosts()
    return (
      <main className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans">
        {/* HEADER */}
        <header className="flex items-center justify-between px-14 py-7">
          {/* Logo */}
          <div className="text-5xl font-bold select-none">
            <span className="text-green-700">gymfluence</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/log-in" className="text-black text-lg font-normal hover:underline">log in</Link>
            <Link href="/sign-up" className="bg-green-700 text-white text-lg px-8 py-3 rounded-xl shadow font-medium hover:bg-green-800 transition">sign up</Link>
          </div>
        </header>

        {/* HERO */}
        <section className="flex flex-col items-center justify-center pt-12 pb-16">
          <h1 className="text-5xl font-extrabold text-black text-center mb-6">
            Empower Trainers. Elevate Gyms. Transform Clients.
          </h1>
          <p className="text-2xl text-black text-center mb-9 font-normal max-w-2xl">
            A shared ecosystem for gyms, trainers, and fitness enthusiasts.<br />
            Gymfluence helps you connect, track, and train. All in one place.
          </p>
          <span className="text-green-700 text-3xl font-bold mb-10">Connect</span>

          {/* SEARCH SECTION */}
          <div className="flex flex-row gap-12 items-start w-full max-w-5xl mx-auto">
            <div className="w-[60%]">
              {/* Replace src below with your actual images if stored locally/publicly */}
              {/* <Image
                src="/Screenshot 2025-07-01 at 7.21.32 PM.png"
                alt="Search screenshot"
                width={900}
                height={430}
                className="rounded-lg shadow"
                priority
              /> */}
            </div>
            <div className="w-[40%] flex flex-col justify-center pt-6">
              <p className="text-2xl font-bold text-black mb-2">
                Connect and grow with<br />gyms, trainers, and<br />fitness enthusiasts.
              </p>
            </div>
          </div>
        </section>

        {/* TRACK SECTION */}
        <section className="flex flex-col items-center justify-center pt-24 pb-12">
          <span className="text-green-700 text-3xl font-bold mb-10">Track</span>
          <div className="w-full max-w-6xl mx-auto">
            {/* <Image
              src="/Screenshot 2025-07-01 at 7.21.51 PM.png"
              alt="Dashboard screenshot"
              width={1200}
              height={480}
              className="rounded-lg shadow"
            /> */}
          </div>
        </section>

        {/* TRAIN SECTION */}
        <section className="flex flex-col items-center justify-center pt-24 pb-12">
          <span className="text-green-700 text-3xl font-bold mb-10">Train</span>
          <div className="flex flex-row gap-20 w-full max-w-6xl mx-auto items-start">
            <div className="w-[35%]">
              {/* <Image
                src="/Screenshot 2025-07-01 at 7.22.03 PM.png"
                alt="Social post screenshot"
                width={360}
                height={420}
                className="rounded-lg shadow"
              /> */}
            </div>
            <div className="w-[65%] flex flex-col justify-center pt-16">
              <p className="text-2xl font-bold text-black mb-2">
                Share results.<br />Build a client base.<br />Create a business.
              </p>
            </div>
          </div>
          {/* Down Arrow */}
          <div className="flex justify-center items-center mt-20 mb-16">
            <svg className="w-10 h-10 text-green-700 animate-bounce" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {/* Tagline & Logo */}
          <div className="flex flex-col items-center mt-10">
            <p className="text-2xl font-bold text-black mb-7 text-center">
              Re-engineering the Fitness Economy.
            </p>
            {/* <Image
              src="/Screenshot 2025-07-01 at 7.22.14 PM.png"
              alt="Logo"
              width={140}
              height={140}
            /> */}
          </div>
        </section>

        {/* CTA & FOOTER */}
        <section className="flex flex-col items-center justify-center pt-32 pb-16 bg-[#FAFAFA]">
          <h2 className="text-3xl font-normal text-black mb-7">
            Become a <span className="font-bold">Gymfluencer</span> today.
          </h2>
          <Link
            href="/get-started"
            className="bg-green-700 text-white text-lg px-10 py-4 rounded-lg font-medium hover:bg-green-800 transition"
          >
            Get Started
          </Link>
        </section>
        <footer className="bg-[#FAFAFA] pt-14 pb-7 border-t">
          <div className="max-w-7xl mx-auto px-14 flex justify-between">
            {/* Footer left - logo and social */}
            <div>
              <div className="text-2xl font-bold text-green-700 mb-5">gymfluence</div>
              <div className="flex gap-5">
                {/* Social icons can be swapped for react-icons or svg inline */}
                <a href="#" className="text-gray-600 hover:text-green-700" aria-label="Facebook"><i className="fab fa-facebook-f" /></a>
                <a href="#" className="text-gray-600 hover:text-green-700" aria-label="LinkedIn"><i className="fab fa-linkedin-in" /></a>
                <a href="#" className="text-gray-600 hover:text-green-700" aria-label="YouTube"><i className="fab fa-youtube" /></a>
                <a href="#" className="text-gray-600 hover:text-green-700" aria-label="Instagram"><i className="fab fa-instagram" /></a>
              </div>
            </div>
            {/* Footer right - links */}
            <div className="flex gap-20">
              {[1, 2, 3].map((topic) => (
                <div key={topic}>
                  <div className="font-bold mb-3">Topic</div>
                  <div className="flex flex-col gap-2">
                    <span className="text-gray-700">Page</span>
                    <span className="text-gray-700">Page</span>
                    <span className="text-gray-700">Page</span>
                    <span className="text-gray-700">Page</span>
                    <span className="text-gray-700">Page</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </main>
  );
}




/* <FormPost />
        {data.map((post) => (
          <h1 key={post.id} className="text-lg py-6">{post.title}</h1>
        ))} */