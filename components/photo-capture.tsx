"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"

type CaptureMode = "select" | "camera" | "preview"

interface MemoryRecord {
    id: number
    session_id: string
    object_image_base64: string
    object_description: string
    object_memory: string
    created_at: string
    updated_at: string
}

export function PhotoCapture() {
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [mode, setMode] = useState<CaptureMode>("select")
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [memories, setMemories] = useState<MemoryRecord[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Initialize session ID on mount
    useEffect(() => {
        let existingSessionId = sessionStorage.getItem("kitchen_memory_session_id")
        if (!existingSessionId) {
            existingSessionId = crypto.randomUUID()
            sessionStorage.setItem("kitchen_memory_session_id", existingSessionId)
        }
        setSessionId(existingSessionId)
    }, [])

    // Fetch memories from the past 24 hours
    const fetchMemories = useCallback(async () => {
        const supabase = getSupabaseClient()

        // Calculate 24 hours ago
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
        // Poll for updates every 3 seconds to show new memories
        const interval = setInterval(fetchMemories, 3000)
        return () => clearInterval(interval)
    }, [fetchMemories])

    // Cleanup camera stream when component unmounts or mode changes
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }, [stream])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            const base64String = reader.result as string
            const base64Data = base64String.split(",")[1]
            setCapturedImage(base64Data)
            setMode("preview")
        }
        reader.readAsDataURL(file)
    }, [])

    const handleUploadClick = () => {
        fileInputRef.current?.click()
    }

    const handleCameraClick = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false,
            })
            setStream(mediaStream)
            setMode("camera")

            // Wait for next tick to ensure video element is rendered
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream
                }
            }, 100)
        } catch (error) {
            console.error("Error accessing camera:", error)
            alert("Unable to access camera. Please check permissions or use Upload Photo instead.")
        }
    }

    const handleCapturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Draw current video frame to canvas
        const ctx = canvas.getContext("2d")
        if (ctx) {
            ctx.drawImage(video, 0, 0)

            // Convert canvas to base64
            const base64Data = canvas.toDataURL("image/png").split(",")[1]
            setCapturedImage(base64Data)

            // Stop camera stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
                setStream(null)
            }

            setMode("preview")
        }
    }

    const handleRetake = () => {
        setCapturedImage(null)
        setMode("select")

        // Stop camera if it's running
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleCancelCamera = () => {
        // Stop camera stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }
        setMode("select")
    }

    const handleSavePhoto = useCallback(async () => {
        if (!capturedImage || !sessionId) return

        // Start processing in background and immediately reset to allow new capture
        const imageToProcess = capturedImage
        setCapturedImage(null)
        setMode("select")

        try {
            // Call API to generate description and memory based on the image
            const response = await fetch("/api/analyze-object", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    imageBase64: imageToProcess,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to analyze object")
            }

            const data = await response.json()

            // Save to database
            const supabase = getSupabaseClient()
            const { error } = await supabase
                .from("object_memories")
                .insert({
                    session_id: sessionId,
                    object_image_base64: imageToProcess,
                    object_description: data.description || "",
                    object_memory: data.memory || "",
                })

            if (error) {
                console.error("Error saving memory:", error)
            } else {
                console.log("Memory saved successfully in background")
                // Immediately fetch to show the new memory
                fetchMemories()
            }
        } catch (error) {
            console.error("Error analyzing object:", error)
        }
    }, [capturedImage, sessionId, fetchMemories])

    const truncateText = (text: string, maxLength: number = 50) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    return (
        <div className="flex flex-col items-center gap-6 sm:gap-8">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Hidden canvas for capturing camera frames */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Mode: Select (Upload or Camera) */}
            {mode === "select" && (
                <>
                    <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 sm:h-[350px] sm:w-[350px]">
                        <div className="flex flex-col items-center gap-4 p-8 text-center">
                            <span className="text-6xl">📸</span>
                            <p className="text-lg font-medium text-muted-foreground">
                                Upload a photo or take a picture
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button size="lg" onClick={handleUploadClick} className="min-w-40">
                            Upload Photo
                        </Button>
                        <Button size="lg" variant="outline" onClick={handleCameraClick} className="min-w-40">
                            Take Photo
                        </Button>
                    </div>

                    <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Upload a photo of an object or use your camera to capture one. AI will analyze it in the background while you continue capturing more objects.
                        </p>
                    </div>
                </>
            )}

            {/* Mode: Camera (Live camera view) */}
            {mode === "camera" && (
                <>
                    <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-black shadow-lg sm:h-[350px] sm:w-[350px]">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="h-full w-full object-cover"
                        />
                    </div>

                    <div className="flex gap-4">
                        <Button size="lg" variant="outline" onClick={handleCancelCamera} className="min-w-40">
                            Cancel
                        </Button>
                        <Button size="lg" onClick={handleCapturePhoto} className="min-w-40">
                            Capture
                        </Button>
                    </div>

                    <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Position your object in the frame and click Capture when ready.
                        </p>
                    </div>
                </>
            )}

            {/* Mode: Preview (Retake or Save) */}
            {mode === "preview" && (
                <>
                    <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted/30 shadow-lg sm:h-[350px] sm:w-[350px]">
                        {capturedImage && (
                            <img
                                src={`data:image/png;base64,${capturedImage}`}
                                alt="Captured object"
                                className="h-full w-full object-cover"
                            />
                        )}
                    </div>

                    <div className="flex gap-4">
                        <Button size="lg" variant="outline" onClick={handleRetake} className="min-w-40">
                            Retake
                        </Button>
                        <Button size="lg" onClick={handleSavePhoto} className="min-w-40">
                            Save
                        </Button>
                    </div>

                    <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Click Save to process this image in the background. You can immediately capture another object while this one is being analyzed.
                        </p>
                    </div>
                </>
            )}

            {/* Recent Memories Table */}
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
                                                        <span className="text-2xl">🍳</span>
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
