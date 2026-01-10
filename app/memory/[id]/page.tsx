"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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

export default function MemoryDetailPage() {
    const params = useParams()
    const router = useRouter()
    const memoryId = params.id as string

    const [memory, setMemory] = useState<MemoryRecord | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [currentMemory, setCurrentMemory] = useState("")
    const [originalMemory, setOriginalMemory] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const fetchMemory = useCallback(async () => {
        if (!memoryId) return

        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from("object_memories")
            .select("*")
            .eq("id", parseInt(memoryId))
            .single()

        if (error) {
            console.error("Error fetching memory:", error)
        } else if (data) {
            setMemory(data)
            setCurrentMemory(data.object_memory || "")
            setOriginalMemory(data.object_memory || "")
        }
        setIsLoading(false)
    }, [memoryId])

    useEffect(() => {
        fetchMemory()
    }, [fetchMemory])

    const handleMemoryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCurrentMemory(e.target.value)
    }

    const handleSaveMemoryEdit = async () => {
        if (!memory) return
        setIsSaving(true)

        const supabase = getSupabaseClient()
        const { error } = await supabase
            .from("object_memories")
            .update({
                object_memory: currentMemory,
                updated_at: new Date().toISOString(),
            })
            .eq("id", memory.id)

        if (error) {
            console.error("Error updating memory:", error)
        } else {
            setOriginalMemory(currentMemory)
            await fetchMemory()
        }
        setIsSaving(false)
    }

    const handleCancelEdit = () => {
        setCurrentMemory(originalMemory)
    }

    const hasChanges = currentMemory !== originalMemory

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex flex-1 items-center justify-center pt-16">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </main>
                <Footer />
            </div>
        )
    }

    if (!memory) {
        return (
            <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1 pt-16">
                    <div className="px-4 pt-4">
                        <Link
                            href="/memories"
                            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <span className="text-xl">&larr;</span>
                            <span>Back to Memories</span>
                        </Link>
                    </div>
                    <div className="flex flex-col items-center justify-center py-20">
                        <p className="text-lg text-muted-foreground">Memory not found</p>
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Header />

            {/* Main content with padding for fixed header */}
            <main className="flex-1 pt-16">
                {/* Back Button */}
                <div className="px-4 pt-4">
                    <Link
                        href="/memories"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <span className="text-xl">&larr;</span>
                        <span>Back to Memories</span>
                    </Link>
                </div>

                {/* Memory Detail Section */}
                <section className="px-4 py-8 sm:py-12 md:py-16">
                    <div className="mx-auto max-w-4xl">
                        <div className="flex flex-col items-center gap-6 sm:gap-8">
                            {/* Memory ID and Date */}
                            <div className="w-full max-w-md text-center">
                                <h1 className="text-2xl font-bold text-foreground">Memory #{memory.id}</h1>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Created: {new Date(memory.created_at).toLocaleString("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                    })}
                                </p>
                                {memory.updated_at !== memory.created_at && (
                                    <p className="text-sm text-muted-foreground">
                                        Updated: {new Date(memory.updated_at).toLocaleString("en-US", {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                            hour: "numeric",
                                            minute: "2-digit",
                                            hour12: true,
                                        })}
                                    </p>
                                )}
                            </div>

                            {/* Image Display */}
                            <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted/30 shadow-lg sm:h-[350px] sm:w-[350px]">
                                {memory.object_image_base64 ? (
                                    <img
                                        src={`data:image/png;base64,${memory.object_image_base64}`}
                                        alt={`Memory ${memory.id}`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 p-8 text-center">
                                        <span className="text-6xl">🍳</span>
                                        <p className="text-lg font-medium text-muted-foreground">No image</p>
                                    </div>
                                )}
                            </div>

                            {/* Description (read-only) */}
                            <div className="w-full max-w-md">
                                <label className="mb-2 block text-sm font-medium text-muted-foreground">Description</label>
                                <div className="min-h-[80px] rounded-lg border border-border bg-muted/30 p-4 text-foreground">
                                    {memory.object_description || (
                                        <span className="text-muted-foreground italic">No description</span>
                                    )}
                                </div>
                            </div>

                            {/* Memory (editable) */}
                            <div className="w-full max-w-md">
                                <label className="mb-2 block text-sm font-medium text-muted-foreground">Memory (editable)</label>
                                <Textarea
                                    value={currentMemory}
                                    onChange={handleMemoryChange}
                                    placeholder="No memory text"
                                    className="min-h-[120px] resize-none"
                                    disabled={isSaving}
                                />
                                <div className="mt-2 flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        disabled={!hasChanges || isSaving}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleSaveMemoryEdit}
                                        disabled={!hasChanges || isSaving}
                                        className="min-w-[80px]"
                                    >
                                        {isSaving ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                                        ) : (
                                            "Save"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    )
}
