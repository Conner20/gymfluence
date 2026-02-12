import { NextResponse } from "@/node_modules/next/server"
import { db } from "@/prisma/client";
import { hash } from "bcrypt";
import z from "zod";
import { getBaseUrl } from "@/lib/base-url";
import { generateRawToken } from "@/lib/token";
import { sendEmailVerificationEmail } from "@/lib/mail";

// Define a schema for input validation

const userSchema = z.object({
    username: z.string().min(1, "Username is required").max(20),
    email: z.string().min(1, 'Email is required').email('Invalid email'),
    password: z.string().min(1, 'Password is required').min(8, 'Password must have more than 8 characters'),
    location: z.string().min(1, "Location is required"),
})

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, username, password, location } = userSchema.parse(body);
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim();
        
        // check if email already exists
        const existingUserByEmail = await db.user.findUnique({
            where: { email: normalizedEmail }
        });
        if (existingUserByEmail) {
            return NextResponse.json({ user: null, message: "User with this email already exists" }, { status: 409 })
        }

        // check if username already exists
        const existingUserByUsername = await db.user.findUnique({
            where: { username: normalizedUsername }
        });
        if (existingUserByUsername) {
            return NextResponse.json({ user: null, message: "User with this username already exists" }, { status: 409 })
        }

        const hashedPassword = await hash(password, 10);
        const newUser = await db.user.create({
            data: {
                username: normalizedUsername,
                email: normalizedEmail,
                password: hashedPassword,
                location,
            }
        });

        await db.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });
        const verificationToken = generateRawToken(32);
        await db.verificationToken.create({
            data: {
                identifier: normalizedEmail,
                token: verificationToken,
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
            },
        });
        const baseUrl = getBaseUrl();
        const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
        await sendEmailVerificationEmail(normalizedEmail, verifyUrl);

        const { password: newUserPassword, ...rest } = newUser

        return NextResponse.json({ user: rest, message: "User created successfully" }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: "Something went wrong." }, { status: 500 });
    }
}
