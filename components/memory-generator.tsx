"use client"

import { useState, useCallback, useEffect } from "react"
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

export function MemoryGenerator() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [currentDescription, setCurrentDescription] = useState<string>("")
  const [currentMemory, setCurrentMemory] = useState<string>("")
  const [originalMemory, setOriginalMemory] = useState<string>("")
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
      .from("object_memories")
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
        .from("object_memories")
        .insert({
          session_id: sessionId,
          object_image_base64: image,
          object_description: description,
          object_memory: memory,
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
        .from("object_memories")
        .update({
          object_memory: newMemory,
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
      const response = await fetch("/api/generate-object", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to generate object")
      }

      const data = await response.json()
      console.log("Generated:", data)

      setCurrentImage(data.imageBase64 || null)
      setCurrentDescription(data.description || "")
      setCurrentMemory(data.memory || "")
      setOriginalMemory(data.memory || "")
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
    setIsSaving(true)
    await updateMemoryInDb(currentRecordId, currentMemory)
    setOriginalMemory(currentMemory)
    setIsSaving(false)
  }, [currentRecordId, currentMemory, updateMemoryInDb])

  const handleCancelEdit = useCallback(() => {
    setCurrentMemory(originalMemory)
  }, [originalMemory])

  const handleSelectMemory = useCallback((record: MemoryRecord) => {
    setCurrentImage(record.object_image_base64 || null)
    setCurrentDescription(record.object_description || "")
    setCurrentMemory(record.object_memory || "")
    setOriginalMemory(record.object_memory || "")
    setCurrentRecordId(record.id)
    setHasGenerated(true)
  }, [])

  const hasChanges = currentMemory !== originalMemory

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-8">
      {/* Generate Button - moved to top */}
      <Button size="lg" onClick={handleGenerate} disabled={isGenerating} className="min-w-48">
        {isGenerating ? "Generating..." : "Generate Memory"}
      </Button>

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
          disabled={!hasGenerated || isSaving}
        />
        {hasGenerated && (
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
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Click &quot;Generate Memory&quot; to create a random kitchen object with an AI-generated image, description,
          and nostalgic memory. You can edit the memory text after it&apos;s generated.
        </p>
      </div>

      {/* Memories Gallery Section */}
      <div className="mt-12 w-full max-w-4xl">
        <h2 className="mb-2 text-xl font-semibold tracking-wide text-foreground">
          Your Memories
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Click on a memory to view and edit it
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memories.length > 0 ? (
            memories.map((record) => (
              <button
                key={record.id}
                onClick={() => handleSelectMemory(record)}
                className={`group relative overflow-hidden rounded-xl border-2 bg-card/50 p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md ${
                  currentRecordId === record.id ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                {/* Image thumbnail */}
                <div className="mb-3 aspect-square w-full overflow-hidden rounded-lg bg-muted/30">
                  {record.object_image_base64 ? (
                    <img
                      src={`data:image/png;base64,${record.object_image_base64}`}
                      alt={`Object ${record.id}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-4xl">🍳</span>
                    </div>
                  )}
                </div>

                {/* Memory preview */}
                <p className="line-clamp-3 text-sm italic text-muted-foreground">
                  {record.object_memory || "No memory text"}
                </p>

                {/* Date */}
                <p className="mt-2 text-xs text-muted-foreground/70">
                  {new Date(record.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>

                {/* Selected indicator */}
                {currentRecordId === record.id && (
                  <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Selected
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="col-span-full rounded-xl border-2 border-dashed border-border bg-muted/20 p-12 text-center">
              <span className="text-4xl">🍳</span>
              <p className="mt-4 text-muted-foreground">
                No memories yet. Click &quot;Generate Memory&quot; to create your first one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
