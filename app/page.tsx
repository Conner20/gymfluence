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
      <main className="py-4 px-48">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-green-600">
            Gymfluence
          </h1>
          <div className="flex gap-4 mt-4">
            <Link className="bg-green-600 font-medium py-2 px-4 rounded-md" href={'/sign-up'}>Sign up</Link>
            <Link className="bg-green-600 font-medium py-2 px-4 rounded-md" href={'/log-in'}>Log in</Link>
          </div>
        </div>
        <FormPost />
        {data.map((post) => (
          <h1 key={post.id} className="text-lg py-6">{post.title}</h1>
        ))}
      </main>
  );
}
