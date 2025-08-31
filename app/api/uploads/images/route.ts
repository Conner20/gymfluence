// app/api/uploads/images/route.ts
// Multipart image uploads for DMs.
// - If AWS env vars are set *and* @aws-sdk/client-s3 is installed, uploads go to S3.
// - Otherwise, images are saved locally under /public/uploads/messages and served statically.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

// ---- Config ----
const S3_REGION = process.env.AWS_REGION || "";
const S3_BUCKET = process.env.AWS_S3_BUCKET || "";
const S3_PUBLIC_BASE =
    process.env.AWS_S3_PUBLIC_BASE_URL ||
    (S3_BUCKET && S3_REGION ? `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : "");

const MAX_FILES = 10;
const MAX_BYTES = Number(process.env.S3_MAX_IMAGE_BYTES || 8 * 1024 * 1024); // 8MB
const ALLOWED_PREFIX = "image/";

// ---- Helpers ----
function safeName(name: string) {
    return name.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
}

async function saveToLocal(file: File) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const keyPart = `${Date.now()}-${randomUUID()}-${safeName(file.name || "upload")}`;
    const relPath = path.join("messages", keyPart); // uploads/messages/<file>
    const baseDir = path.join(process.cwd(), "public", "uploads");
    const outDir = path.join(baseDir, "messages");
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(baseDir, relPath);
    await fs.writeFile(outPath, bytes);
    // Served by Next.js static file server from /public
    return `/uploads/${relPath.replace(/\\/g, "/")}`;
}

// Lazy-load AWS SDK only if configured AND installed
async function saveToS3(file: File) {
    if (!S3_REGION || !S3_BUCKET || !S3_PUBLIC_BASE) {
        throw new Error("S3 not configured");
    }

    // Dynamically import so builds do not fail if the package is not installed.
    // If you want S3, run:  npm i @aws-sdk/client-s3
    let S3Client: any, PutObjectCommand: any;
    try {
        const mod = await import("@aws-sdk/client-s3");
        S3Client = mod.S3Client;
        PutObjectCommand = mod.PutObjectCommand;
    } catch {
        throw new Error("AWS SDK not installed");
    }

    const s3 = new S3Client({ region: S3_REGION });

    const bytes = Buffer.from(await file.arrayBuffer());
    const key = `messages/${Date.now()}-${randomUUID()}-${safeName(file.name || "upload")}`;

    await s3.send(
        new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: bytes,
            ContentType: file.type || "application/octet-stream",
            ACL: "public-read", // adjust if your bucket policy disallows ACLs
        })
    );

    return `${S3_PUBLIC_BASE}/${key}`;
}

/**
 * POST /api/uploads/images
 * multipart/form-data where field name is "images" (can repeat up to 10)
 * Returns: { urls: string[] }
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !(session as any)?.user?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ message: "Invalid form-data" }, { status: 400 });
    }

    const files = form.getAll("images").filter(Boolean) as File[];
    if (files.length === 0) {
        return NextResponse.json({ message: "No files" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
        return NextResponse.json({ message: `Too many files (max ${MAX_FILES})` }, { status: 400 });
    }

    for (const f of files) {
        if (!f.type?.startsWith(ALLOWED_PREFIX)) {
            return NextResponse.json({ message: "Only image files are allowed." }, { status: 400 });
        }
        const size = (f as any).size as number;
        if (size > MAX_BYTES) {
            return NextResponse.json(
                { message: `Image too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB).` },
                { status: 400 }
            );
        }
    }

    try {
        const urls: string[] = [];
        const useS3 = Boolean(S3_BUCKET && S3_REGION && S3_PUBLIC_BASE);

        for (const f of files) {
            if (useS3) {
                // Try S3 first; if AWS SDK missing, fall back to local
                try {
                    urls.push(await saveToS3(f));
                    continue;
                } catch {
                    // fall through to local
                }
            }
            urls.push(await saveToLocal(f));
        }

        return NextResponse.json({ urls });
    } catch {
        return NextResponse.json({ message: "Upload failed" }, { status: 500 });
    }
}
