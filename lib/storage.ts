// lib/storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { UTApi, UTFile } from "uploadthing/server";

type UploadResult = {
    url: string;
    provider: "uploadthing" | "local";
    storageKey?: string;
};

const UPLOADTHING_AVAILABLE =
    Boolean(process.env.UPLOADTHING_TOKEN) ||
    Boolean(process.env.UPLOADTHING_SECRET);

const utapi = UPLOADTHING_AVAILABLE ? new UTApi() : null;

const MIME_EXTENSIONS: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
};

function detectExtension(file: File) {
    if (file.type && MIME_EXTENSIONS[file.type]) {
        return MIME_EXTENSIONS[file.type];
    }
    const name = file.name ?? "";
    const fromName = name.includes(".") ? name.split(".").pop() : "";
    if (fromName && fromName.length <= 5) {
        return fromName.toLowerCase();
    }
    return "bin";
}

function sanitizePrefix(prefix?: string | null) {
    if (!prefix) return "upload";
    return prefix.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 40) || "upload";
}

function getUploadFolder(folder?: string) {
    const base = path.join(process.cwd(), "public", "uploads");
    if (!folder) return base;
    const safeFolder = folder.replace(/^\/*/, "").replace(/\.\./g, "");
    return path.join(base, safeFolder);
}

async function toUTFile(file: File, fallbackPrefix: string) {
    if (file.constructor.name === "File") {
        return file;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectExtension(file);
    const filename = `${fallbackPrefix}.${ext}`;
    return new UTFile([buffer], filename, { type: file.type || "application/octet-stream" });
}

export async function storeImageFile(
    file: File,
    opts: { folder?: string; prefix?: string } = {},
): Promise<UploadResult> {
    const prefix = sanitizePrefix(opts.prefix);
    if (utapi) {
        const namedFile = await toUTFile(file, prefix);
        const uploaded = await utapi.uploadFiles(namedFile, {
            contentDisposition: "inline",
        });
        const result = Array.isArray(uploaded) ? uploaded[0] : uploaded;

        if (!result || result.error || !result.data) {
            throw new Error(result?.error?.message || "Upload failed");
        }

        return {
            url: result.data.ufsUrl || result.data.url,
            storageKey: result.data.key,
            provider: "uploadthing",
        };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folderPath = getUploadFolder(opts.folder);
    await fs.mkdir(folderPath, { recursive: true });

    const ext = detectExtension(file);
    const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const fullPath = path.join(folderPath, filename);

    try {
        await fs.writeFile(fullPath, buffer);
    } catch (err: any) {
        // Common on Vercel/readonly runtimes or missing writable path
        if (err?.code === "EROFS" || err?.code === "EACCES" || err?.code === "ENOENT") {
            throw new Error(
                "Local uploads are not supported in this environment. Configure UploadThing (UPLOADTHING_TOKEN) or another remote storage provider."
            );
        }
        throw err;
    }

    const relativeFolder = opts.folder
        ? `/${opts.folder.replace(/^\/*/, "")}`
        : "";
    const url = `/uploads${relativeFolder}/${filename}`;

    return {
        url,
        storageKey: url,
        provider: "local",
    };
}

function isUploadthingUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.endsWith("utfs.io") || parsed.hostname.includes("uploadthing");
    } catch {
        return false;
    }
}

function extractUploadthingKey(url: string) {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split("/").filter(Boolean);
        return parts.pop() ?? null;
    } catch {
        return null;
    }
}

export async function deleteStoredFile(url?: string | null) {
    if (!url) return;

    if (utapi && isUploadthingUrl(url)) {
        const key = extractUploadthingKey(url);
        if (key) {
            await utapi.deleteFiles(key).catch(() => { });
        }
        return;
    }

    if (url.startsWith("/uploads")) {
        const safeRelative = url.replace(/^\/+/, "");
        const withoutUploads = safeRelative.replace(/^uploads\/?/, "");
        const fullPath = path.join(process.cwd(), "public", "uploads", withoutUploads);
        await fs.unlink(fullPath).catch(() => { });
    }
}
