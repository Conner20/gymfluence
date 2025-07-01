import type { NextApiRequest, NextApiResponse } from "@/node_modules/next/types";
import prisma from "@/prisma/client";

type postProps = {
    title: string,
    userId: number
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const post: postProps = JSON.parse(req.body)
        if (req.method === "POST") {
            if(!post.title.length) {
                return res.status(500).json({ message: "Please include title" })
            }
            try {
                const data = await prisma.post.create({
                    data: {
                        title: post.title,
                        userId: post.userId
                    },
                })
                res.status(200).json(data)
            } catch (error) {
                return res.status(500).json({ message: "Error creating a new post" })
            }
        }

    } catch (error) {
        return res.status(500).json(error)
    }

}