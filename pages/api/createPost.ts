import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/prisma/client";

type postProps = {
    title: string;
    userId: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const post: postProps = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        if (req.method === "POST") {
            if (!post?.title?.length) {
                return res.status(500).json({ message: "Please include title" });
            }
            try {
                const data = await db.post.create({
                    data: {
                        title: post.title,
                        authorId: post.userId,
                        content: "",
                    },
                });
                res.status(200).json(data);
            } catch (error) {
                return res.status(500).json({ message: "Error creating a new post" });
            }
        }
    } catch (error) {
        return res.status(500).json(error)
    }

}
