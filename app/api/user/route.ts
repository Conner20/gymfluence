import { NextResponse } from "@/node_modules/next/server"
import { db } from "@/prisma/client";

// import prisma from "@/prisma/client";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, username, password } = body;
        
        const existingUserByEmail = await db.user.findUnique({
            where: { email: email }
        });
        if (existingUserByEmail) {
            return NextResponse.json({ user: null, message: "User with this email already exists" }, { status: 409 })
        }

        // check if username already exists
        const existingUserByUsername = await db.user.findUnique({
            where: { username: username }
        });

        if (existingUserByUsername) {
            return NextResponse.json({ user: null, message: "User with this email already exists" }, { status: 409 })
        }

        return NextResponse.json(body);
    } catch (error) {

    }
}