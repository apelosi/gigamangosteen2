"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/lib/supabase/client"

interface MemoryRecord {
  id: number
  session_id: string
  kitchen_image: string
  kitchen_description: string
  kitchen_memory: string
  created_at: string
  updated_at: string
}

export function MemoryGenerator() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [currentDescription, setCurrentDescription] = useState<string>("")
  const [currentMemory, setCurrentMemory] = useState<string>("")
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)

  // Initialize session ID on mount (persists for browser session)
  useEffect(() => {
    // Check if we already have a session ID in sessionStorage
    let existingSessionId = sessionStorage.getItem("kitchen_memory_session_id")
    if (!existingSessionId) {
      existingSessionId = crypto.randomUUID()
      sessionStorage.setItem("kitchen_memory_session_id", existingSessionId)
    }
    console.log("Session ID:", existingSessionId)
    setSessionId(existingSessionId)
  }, [])

  const fetchMemories = useCallback(async () => {
    if (!sessionId) {
      console.log("No sessionId, skipping fetch")
      return
    }

    console.log("Fetching memories for session:", sessionId)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("kitchen_memories")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching memories:", error)
    } else if (data) {
      console.log("Memories fetched:", data)
      setMemories(data)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) {
      fetchMemories()
    }
  }, [sessionId, fetchMemories])

  const saveMemory = useCallback(
    async (image: string, description: string, memory: string) => {
      if (!sessionId) return null

      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from("kitchen_memories")
        .insert({
          session_id: sessionId,
          kitchen_image: image,
          kitchen_description: description,
          kitchen_memory: memory,
        })
        .select()
        .single()

      if (error) {
        console.error("Error saving memory:", error)
        return null
      }

      console.log("Memory saved:", data)
      fetchMemories()
      return data
    },
    [sessionId, fetchMemories],
  )

  const updateMemoryInDb = useCallback(
    async (recordId: number, newMemory: string) => {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from("kitchen_memories")
        .update({
          kitchen_memory: newMemory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId)

      if (error) {
        console.error("Error updating memory:", error)
        return
      }

      console.log("Memory updated for record:", recordId)
      fetchMemories()
    },
    [fetchMemories],
  )

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setHasGenerated(false)

    try {
      const response = await fetch("/api/generate-kitchen-object", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to generate kitchen object")
      }

      const data = await response.json()
      console.log("Generated:", data)

      setCurrentImage(data.imageBase64 || null)
      setCurrentDescription(data.description || "")
      setCurrentMemory(data.memory || "")
      setHasGenerated(true)

      // Save to database as a new record
      const savedRecord = await saveMemory(data.imageBase64 || "", data.description || "", data.memory || "")
      if (savedRecord) {
        setCurrentRecordId(savedRecord.id)
      }
    } catch (error) {
      console.error("Error generating:", error)
    } finally {
      setIsGenerating(false)
    }
  }, [saveMemory])

  const handleMemoryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentMemory(e.target.value)
  }

  const handleSaveMemoryEdit = useCallback(async () => {
    if (!currentRecordId) return
    await updateMemoryInDb(currentRecordId, currentMemory)
  }, [currentRecordId, currentMemory, updateMemoryInDb])

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-8">
      {/* Image Display */}
      <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 sm:h-[350px] sm:w-[350px]">
        {isGenerating ? (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Generating...</p>
          </div>
        ) : currentImage ? (
          <img
            src={`data:image/png;base64,${currentImage}`}
            alt="Generated kitchen object"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="text-6xl">🍳</span>
            <p className="text-lg font-medium text-muted-foreground">Press Generate to create a memory</p>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <Button size="lg" onClick={handleGenerate} disabled={isGenerating} className="min-w-48">
        {isGenerating ? "Generating..." : "Generate Memory"}
      </Button>

      {/* Description (read-only) */}
      <div className="w-full max-w-md">
        <label className="mb-2 block text-sm font-medium text-muted-foreground">Description</label>
        <div className="min-h-[80px] rounded-lg border border-border bg-muted/30 p-4 text-foreground">
          {currentDescription || (
            <span className="text-muted-foreground italic">Description will appear here after generation...</span>
          )}
        </div>
      </div>

      {/* Memory (editable) */}
      <div className="w-full max-w-md">
        <label className="mb-2 block text-sm font-medium text-muted-foreground">Memory (editable)</label>
        <Textarea
          value={currentMemory}
          onChange={handleMemoryChange}
          placeholder="Memory will appear here after generation..."
          className="min-h-[120px] resize-none"
          disabled={!hasGenerated}
        />
        {hasGenerated && (
          <Button variant="outline" size="sm" onClick={handleSaveMemoryEdit} className="mt-2">
            Save Edit
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Click &quot;Generate Memory&quot; to create a random kitchen object with an AI-generated image, description,
          and nostalgic memory. You can edit the memory text after it&apos;s generated.
        </p>
      </div>

      {/* Database Debug Section */}
      <div className="mt-12 w-full max-w-4xl">
        <h2 className="mb-2 text-xl font-semibold uppercase tracking-wide text-muted-foreground">
          DATABASE RECORDS (DEVELOPMENT)
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Session ID: <span className="font-mono">{sessionId || "Loading..."}</span> | Records: {memories.length}
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/50 p-8 shadow-sm backdrop-blur-sm">
          {memories.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">id</th>
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">kitchen_image</th>
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">
                      kitchen_description
                    </th>
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">kitchen_memory</th>
                    <th className="pb-4 text-left text-base font-normal text-muted-foreground">created_at</th>
                  </tr>
                </thead>
                <tbody>
                  {memories.map((record) => (
                    <tr key={record.id} className="border-b border-border/30">
                      <td className="py-4 pr-8 font-mono text-sm text-foreground">{record.id}</td>
                      <td className="py-4 pr-8 text-xs text-foreground">
                        {record.kitchen_image ? (
                          <img
                            src={`data:image/png;base64,${record.kitchen_image}`}
                            alt={`Kitchen object ${record.id}`}
                            className="h-16 w-16 rounded object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground">No image</span>
                        )}
                      </td>
                      <td className="py-4 pr-8 text-sm text-foreground max-w-xs">{record.kitchen_description}</td>
                      <td className="py-4 pr-8 text-sm text-foreground max-w-md italic">{record.kitchen_memory}</td>
                      <td className="py-4 text-sm text-foreground">
                        {new Date(record.created_at).toLocaleString("en-US", {
                          month: "numeric",
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
          ) : (
            <p className="text-center text-muted-foreground">
              No memories yet. Click &quot;Generate Memory&quot; to create one.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
