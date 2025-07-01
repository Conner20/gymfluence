"use client"

import React, { useState } from "react"

export default function FormPost() {
    const [title, setTitle] = useState("")

    async function submitPost(e: React.FormEvent) {
        e.preventDefault()
        const data = await fetch(`/api/createPost`, {
            method: "POST",
            body: JSON.stringify({ title }),
        })
        const res = await data.json()
        if (!res.ok) console.log(res.message)
    }

    return (
        <form onSubmit={submitPost}>
            <input 
                onChange={(e) => setTitle(e.target.value)}
                value={title}
                type="text"
            />
            <button type="submit">Make a new post</button>
        </form>
    )
}