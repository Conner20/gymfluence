# Fitting In

Re-engineering the fitness economy through social media.

## Tech Stack

Next.js (TypeScript), Tailwind CSS, NextAuth.js, PostgreSQL via Prisma, Next.js API Routes, Railway

### Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment variables

Create a `.env.local` (or configure variables in Vercel) containing at least:

```
DATABASE_URL=postgres://...
NEXTAUTH_SECRET=your-secret
```

Without the Google keys NextAuth disables OAuth and Google sign-in buttons will remain inactive.
