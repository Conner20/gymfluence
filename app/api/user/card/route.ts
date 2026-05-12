import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

const QR_SIZE = 220;

function xmlEscape(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function toBase64(buffer: ArrayBuffer) {
    return Buffer.from(buffer).toString("base64");
}

async function fetchQrDataUri(url: string) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(url)}`;
    const res = await fetch(qrUrl, { cache: "no-store" });
    if (!res.ok) {
        throw new Error("Failed to generate QR code.");
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();
    return `data:${contentType};base64,${toBase64(buffer)}`;
}

function buildCardSvg({
    displayName,
    roleLabel,
    cardLabel,
    qrDataUri,
}: {
    displayName: string;
    roleLabel: string;
    cardLabel: string;
    qrDataUri: string;
}) {
    const safeName = xmlEscape(displayName);
    const safeRole = xmlEscape(roleLabel);
    const safeLabel = xmlEscape(cardLabel);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440" role="img" aria-label="${safeLabel}">
  <rect width="720" height="440" rx="28" fill="#000000" />

  <text x="56" y="142" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">${safeName}</text>

  <text x="56" y="184" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600" letter-spacing="3">${safeRole.toUpperCase()}</text>

  <rect x="426" y="92" width="258" height="258" rx="0" fill="#ffffff" />
  <image x="445" y="111" width="${QR_SIZE}" height="${QR_SIZE}" href="${qrDataUri}" />

  <text x="56" y="354" fill="#07e072" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="600" letter-spacing="-1.5">fitt</text>
  <text x="129" y="354" fill="#07e072" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="600" letter-spacing="-1.5">in</text>
  <line x1="130" y1="365" x2="169" y2="365" stroke="#07e072" stroke-width="5" stroke-linecap="square" />
  <text x="169" y="354" fill="#07e072" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="600" letter-spacing="-1.5">g</text>
</svg>`;
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
            username: true,
            name: true,
            role: true,
            gymProfile: { select: { name: true } },
        },
    });
    if (!me?.username) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const requestUrl = new URL(req.url);
    const scanUrl = `${requestUrl.origin}/scan/${encodeURIComponent(me.username)}`;
    const roleLabel =
        me.role === "TRAINEE"
            ? "Member"
            : me.role === "TRAINER"
              ? "Trainer"
              : me.role === "GYM"
                ? "Gym"
                : "User";
    const cardLabel = me.role === "TRAINEE" ? "Member Card" : "Business Card";
    const displayName =
        me.role === "GYM"
            ? me.gymProfile?.name || me.name || me.username
            : me.name || me.username;

    try {
        const qrDataUri = await fetchQrDataUri(scanUrl);
        const svg = buildCardSvg({
            displayName,
            roleLabel,
            cardLabel,
            qrDataUri,
        });

        const headers = new Headers({
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store",
        });

        if (requestUrl.searchParams.get("download") === "1") {
            const filename = `${(me.role === "TRAINEE" ? "member-card" : "business-card")}-${me.username}.svg`;
            headers.set("Content-Disposition", `attachment; filename="${filename}"`);
        }

        return new NextResponse(svg, { headers });
    } catch (error) {
        console.error("GET /api/user/card error:", error);
        return NextResponse.json({ message: "Failed to generate card." }, { status: 500 });
    }
}
