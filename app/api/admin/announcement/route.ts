import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasAdminAccessByEmail } from "@/lib/admin";
import { db } from "@/prisma/client";
import { deleteStoredFile, storeImageFile } from "@/lib/storage";

async function getAdminUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await hasAdminAccessByEmail(session.user.email))) {
        return null;
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true, email: true },
    });

    return user ?? null;
}

function normalizeExistingImageUrls(imageUrl: string | null, imageUrls: string[]) {
    return imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [];
}

export async function GET() {
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const announcement = await db.announcement.findFirst({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            title: true,
            content: true,
            imageUrl: true,
            imageUrls: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return NextResponse.json({ announcement });
}

export async function POST(req: Request) {
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
        return NextResponse.json({ message: "Expected multipart form data." }, { status: 400 });
    }

    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();

    if (!title || !content) {
        return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
    }

    const files = form
        .getAll("images")
        .filter((file): file is File => file instanceof File && file.size > 0);

    if (files.length > 5) {
        return NextResponse.json({ message: "You can upload up to 5 images." }, { status: 400 });
    }

    for (const file of files) {
        const maxBytes = 8 * 1024 * 1024;
        if (file.size > maxBytes) {
            return NextResponse.json({ message: "Each image must be 8MB or smaller." }, { status: 400 });
        }
        if (!(file.type || "").startsWith("image/")) {
            return NextResponse.json({ message: "Only image uploads are allowed." }, { status: 400 });
        }
    }

    const previous = await db.announcement.findMany({
        where: { active: true },
        select: { id: true, imageUrl: true, imageUrls: true },
    });

    const uploadedUrls: string[] = [];
    try {
        for (const file of files) {
            const uploaded = await storeImageFile(file, {
                folder: "announcements",
                prefix: `announcement-${admin.id}`,
            });
            uploadedUrls.push(uploaded.url);
        }
    } catch (error: any) {
        const message =
            typeof error?.message === "string" && error.message.includes("Local uploads are not supported")
                ? error.message
                : "Failed to upload image";
        return NextResponse.json({ message }, { status: 503 });
    }

    const announcement = await db.$transaction(async (tx) => {
        await tx.announcement.updateMany({
            where: { active: true },
            data: { active: false },
        });

        return tx.announcement.create({
            data: {
                title,
                content,
                imageUrl: uploadedUrls[0] ?? null,
                imageUrls: uploadedUrls,
                createdById: admin.id,
                active: true,
            },
            select: {
                id: true,
                title: true,
                content: true,
                imageUrl: true,
                imageUrls: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    });

    for (const item of previous) {
        const urls = normalizeExistingImageUrls(item.imageUrl, item.imageUrls);
        for (const url of urls) {
            await deleteStoredFile(url);
        }
    }

    return NextResponse.json({ announcement }, { status: 201 });
}

export async function PATCH(req: Request) {
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const current = await db.announcement.findFirst({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, imageUrl: true, imageUrls: true },
    });

    if (!current) {
        return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") || "";
    let title = "";
    let content = "";
    let nextImageUrls: string[] = [];

    const existingImageUrls = normalizeExistingImageUrls(current.imageUrl, current.imageUrls);

    if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        title = String(form.get("title") || "").trim();
        content = String(form.get("content") || "").trim();

        const retainedValue = String(form.get("retainedImageUrls") || "[]");
        let retainedImageUrls: string[] = [];
        try {
            const parsed = JSON.parse(retainedValue);
            if (Array.isArray(parsed)) {
                retainedImageUrls = parsed.map(String).filter(Boolean);
            }
        } catch {
            retainedImageUrls = existingImageUrls;
        }

        const allowedExisting = new Set(existingImageUrls);
        retainedImageUrls = retainedImageUrls.filter((url) => allowedExisting.has(url));

        const files = form
            .getAll("images")
            .filter((file): file is File => file instanceof File && file.size > 0);

        if (retainedImageUrls.length + files.length > 5) {
            return NextResponse.json({ message: "You can upload up to 5 images." }, { status: 400 });
        }

        for (const file of files) {
            const maxBytes = 8 * 1024 * 1024;
            if (file.size > maxBytes) {
                return NextResponse.json({ message: "Each image must be 8MB or smaller." }, { status: 400 });
            }
            if (!(file.type || "").startsWith("image/")) {
                return NextResponse.json({ message: "Only image uploads are allowed." }, { status: 400 });
            }
        }

        const uploadedUrls: string[] = [];
        try {
            for (const file of files) {
                const uploaded = await storeImageFile(file, {
                    folder: "announcements",
                    prefix: `announcement-${admin.id}`,
                });
                uploadedUrls.push(uploaded.url);
            }
        } catch (error: any) {
            const message =
                typeof error?.message === "string" && error.message.includes("Local uploads are not supported")
                    ? error.message
                    : "Failed to upload image";
            return NextResponse.json({ message }, { status: 503 });
        }

        nextImageUrls = [...retainedImageUrls, ...uploadedUrls];
    } else {
        const body = await req.json().catch(() => ({}));
        title = String(body?.title || "").trim();
        content = String(body?.content || "").trim();
        nextImageUrls = existingImageUrls;
    }

    if (!title || !content) {
        return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
    }

    const announcement = await db.announcement.update({
        where: { id: current.id },
        data: {
            title,
            content,
            imageUrl: nextImageUrls[0] ?? null,
            imageUrls: nextImageUrls,
        },
        select: {
            id: true,
            title: true,
            content: true,
            imageUrl: true,
            imageUrls: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    const removedUrls = existingImageUrls.filter((url) => !nextImageUrls.includes(url));
    for (const url of removedUrls) {
        await deleteStoredFile(url);
    }

    return NextResponse.json({ announcement });
}

export async function DELETE() {
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const current = await db.announcement.findFirst({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, imageUrl: true, imageUrls: true },
    });

    if (!current) {
        return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
    }

    await db.announcement.delete({ where: { id: current.id } });

    for (const url of normalizeExistingImageUrls(current.imageUrl, current.imageUrls)) {
        await deleteStoredFile(url);
    }

    return NextResponse.json({ message: "Announcement deleted." });
}
