"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PhotoCapture } from "@/components/photo-capture"
import { LiveCapture } from "@/components/live-capture"
import { getSupabaseClient } from "@/lib/supabase/client"

type CaptureMode = "photo" | "live"

interface MemoryRecord {
    id: number
    session_id: string
    object_image_base64: string
    object_description: string
    object_memory: string
    created_at: string
    updated_at: string
}

export function CaptureWrapper() {
    const [mode, setMode] = useState<CaptureMode>("photo")
    const [memories, setMemories] = useState<MemoryRecord[]>([])

    // Fetch memories from the past 24 hours
    const fetchMemories = useCallback(async () => {
        const supabase = getSupabaseClient()

        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        const { data, error } = await supabase
            .from("object_memories")
            .select("*")
            .gte("created_at", twentyFourHoursAgo.toISOString())
            .order("created_at", { ascending: false })
            .limit(10)

        if (error) {
            console.error("Error fetching memories:", error)
        } else if (data) {
            setMemories(data)
        }
    }, [])

    // Fetch memories on mount and poll for updates
    useEffect(() => {
        fetchMemories()
        const interval = setInterval(fetchMemories, 3000)
        return () => clearInterval(interval)
    }, [fetchMemories])

    const truncateText = (text: string, maxLength: number = 50) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    return (
        <div className="flex flex-col items-center gap-8">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-border bg-muted/30 p-1">
                <Button
                    variant={mode === "photo" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMode("photo")}
                    className="min-w-32"
                >
                    Photo Mode
                </Button>
                <Button
                    variant={mode === "live" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMode("live")}
                    className="min-w-32"
                >
                    Live Mode
                </Button>
            </div>

            {/* Mode Description */}
            <div className="text-center text-sm text-muted-foreground">
                {mode === "photo" ? (
                    <p>Upload or take a photo - AI generates the memory for you</p>
                ) : (
                    <p>Record video and speak your own memory in real-time</p>
                )}
            </div>

            {/* Content */}
            {mode === "photo" ? <PhotoCapture /> : <LiveCapture />}

            {/* Recent Memories Table - Shared across modes */}
            <div className="mt-12 w-full max-w-4xl">
                <h2 className="mb-4 text-xl font-semibold tracking-wide text-foreground">
                    Recent Memories
                </h2>
                {memories.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-muted/50 text-left">
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
                                        className="transition-colors hover:bg-muted/30"
                                    >
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
                                                        <span className="text-2xl">📷</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="border-b border-border px-4 py-3 text-sm text-foreground">
                                            <div className="max-w-xs break-words">
                                                {truncateText(record.object_description || "Processing...")}
                                            </div>
                                        </td>
                                        <td className="border-b border-border px-4 py-3 text-sm text-foreground">
                                            <div className="max-w-xs break-words">
                                                {truncateText(record.object_memory || "Processing...")}
                                            </div>
                                        </td>
                                        <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                            {new Date(record.created_at).toLocaleString("en-US", {
                                                month: "short",
                                                day: "numeric",
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
                ) : (
                    <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center">
                        <span className="text-4xl">📷</span>
                        <p className="mt-4 text-muted-foreground">
                            No memories yet. Start capturing objects to see them appear here!
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
