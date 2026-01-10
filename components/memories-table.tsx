"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"

interface MemoryRecord {
    id: number
    session_id: string
    object_image_base64: string
    object_description: string
    object_memory: string
    created_at: string
    updated_at: string
}

export function MemoriesTable() {
    const router = useRouter()
    const [memories, setMemories] = useState<MemoryRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [sessionId, setSessionId] = useState<string | null>(null)

    // Get session ID from sessionStorage
    useEffect(() => {
        const existingSessionId = sessionStorage.getItem("kitchen_memory_session_id")
        if (existingSessionId) {
            setSessionId(existingSessionId)
        } else {
            setIsLoading(false)
        }
    }, [])

    const fetchMemories = useCallback(async () => {
        if (!sessionId) {
            setIsLoading(false)
            return
        }

        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from("object_memories")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching memories:", error)
        } else if (data) {
            setMemories(data)
        }
        setIsLoading(false)
    }, [sessionId])

    useEffect(() => {
        if (sessionId) {
            fetchMemories()
        }
    }, [sessionId, fetchMemories])

    const truncateText = (text: string, maxLength: number = 72) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    const handleRowClick = (id: number) => {
        router.push(`/memory/${id}`)
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (memories.length === 0) {
        return (
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-12 text-center">
                <span className="text-4xl">🍳</span>
                <p className="mt-4 text-muted-foreground">
                    No memories yet. Visit the <a href="/capture" className="text-primary hover:underline">Capture</a> page to create your first memory.
                </p>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-muted/50 text-left">
                        <th className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                            ID
                        </th>
                        <th className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                            Image
                        </th>
                        <th className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                            Description
                        </th>
                        <th className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                            Memory
                        </th>
                        <th className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                            Created
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {memories.map((record) => (
                        <tr
                            key={record.id}
                            onClick={() => handleRowClick(record.id)}
                            className="cursor-pointer transition-colors hover:bg-muted/30"
                        >
                            <td className="border-b border-border px-4 py-3 text-sm text-foreground">
                                {record.id}
                            </td>
                            <td className="border-b border-border px-4 py-3">
                                <div className="h-16 w-16 overflow-hidden rounded-md bg-muted/30">
                                    {record.object_image_base64 ? (
                                        <img
                                            src={`data:image/png;base64,${record.object_image_base64}`}
                                            alt={`Memory ${record.id}`}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <span className="text-2xl">🍳</span>
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="border-b border-border px-4 py-3 text-sm text-foreground">
                                <div className="max-w-xs break-words">
                                    {truncateText(record.object_description || "No description")}
                                </div>
                            </td>
                            <td className="border-b border-border px-4 py-3 text-sm text-foreground">
                                <div className="max-w-xs break-words">
                                    {truncateText(record.object_memory || "No memory")}
                                </div>
                            </td>
                            <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
                                {new Date(record.created_at).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
