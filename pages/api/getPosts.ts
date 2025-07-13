import type { NextApiRequest, NextApiResponse } from "@/node_modules/next/types";
import { db } from "@/prisma/client";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if(req.method === 'GET') {
        try {
            const data = await db.post.findMany()
            return res.status(200).json(data)

        } catch(error) {
            return res.status(500).json(error)
        }
        
    }
}