import { getServerSession } from "next-auth";
import { UploadThingError, type FileRouter } from "uploadthing/server";
import { createUploadthing } from "uploadthing/next";

import { authOptions } from "@/lib/auth";

const f = createUploadthing();

export const uploadRouter = {
    postMedia: f({
        image: {
            maxFileSize: "16MB",
            maxFileCount: 3,
        },
    })
        .middleware(async () => {
            const session = await getServerSession(authOptions);
            if (!session?.user?.email) {
                throw new UploadThingError("Unauthorized");
            }

            return {
                userEmail: session.user.email.toLowerCase(),
            };
        })
        .onUploadComplete(async ({ file }) => {
            return {
                url: file.ufsUrl,
            };
        }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
