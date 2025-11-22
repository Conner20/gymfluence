import { env } from "@/lib/env";
import { db } from "@/prisma/client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcrypt";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(db),
    secret: env.NEXTAUTH_SECRET,
    session: {
        strategy: 'jwt'
    },
    pages: {
        signIn: '/log-in',
    },
    providers: [
        GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Username", type: "text", placeholder: "jsmith" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if(!credentials?.email || !credentials?.password) {
                    return null;
                }
                const existingUser = await db.user.findUnique({
                    where: { email: credentials.email }
                });
                if(!existingUser) {
                    return null;
                }
                if(existingUser.password) {
                    const passwordMatch = await compare(credentials.password, existingUser.password);
                    if (!passwordMatch) {
                        return null;
                    }
                }

                return {
                    id: `${existingUser.id}`,
                    username: existingUser.username,
                    email: existingUser.email
                }
            }
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "google" && user?.id) {
                const dbUser = await db.user.findUnique({
                    where: { id: user.id as string },
                    select: { id: true, username: true, role: true, email: true, name: true },
                });

                if (!dbUser?.username || !dbUser?.role) {
                    const params = new URLSearchParams();
                    params.set("google", "1");
                    if (dbUser?.email || user.email) {
                        params.set("email", String(dbUser?.email ?? user.email));
                    }
                    if (dbUser?.username || dbUser?.name || user.name) {
                        params.set("name", String(dbUser?.username ?? dbUser?.name ?? user.name ?? ""));
                    }
                    return `/sign-up?${params.toString()}`;
                }
            }

            return true;
        },
        async jwt({ token, user }) {
            console.log(token, user);
            if(user) {
                return {
                    ...token,
                    username: user.username
                }
            }
            return token
        },
        async session({ session, user, token }) {
            return {
                ...session,
                user: {
                    ...session.user,
                    username: token.username
                }
            }
        }
    }
}
