import NextAuth from "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
    interface User {
        id?: string
        username: string | null
    }
    interface Session {
        user: User & {
            id?: string
            email?: string | null
            name?: string | null
            username: string | null
        }
        token: {
            username: string | null
        }
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        username?: string | null
    }
}
