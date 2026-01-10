"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

type CaptureMode = "select" | "camera" | "preview" | "result"

interface MatchResult {
    description: string
    objectType: string
    matched: boolean
    matchedMemory: string | null
    matchedRecord: {
        id: number
        object_description: string
        object_memory: string
        object_image_base64: string
        created_at: string
    } | null
    confidence?: string
    reason?: string
}

export function RememberCapture() {
    const [mode, setMode] = useState<CaptureMode>("select")
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

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
        setMatchResult(null)
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

    const handleFindMatch = useCallback(async () => {
        if (!capturedImage) return

        setIsProcessing(true)

        try {
            const response = await fetch("/api/match-object", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    imageBase64: capturedImage,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to match object")
            }

            const data = await response.json()
            setMatchResult(data)
            setMode("result")
        } catch (error) {
            console.error("Error matching object:", error)
            setMatchResult({
                description: "",
                objectType: "",
                matched: false,
                matchedMemory: null,
                matchedRecord: null,
                reason: "An error occurred while trying to match the object."
            })
            setMode("result")
        } finally {
            setIsProcessing(false)
        }
    }, [capturedImage])

    const handleTryAgain = () => {
        setCapturedImage(null)
        setMatchResult(null)
        setMode("select")

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = ""
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
                            <span className="text-6xl">🔍</span>
                            <p className="text-lg font-medium text-muted-foreground">
                                Upload a photo to find its memory
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
                            Take a photo of an object to see if it matches any of your saved memories. The AI will analyze the image and search for a matching object.
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

            {/* Mode: Preview (Retake or Find Match) */}
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
                        <Button size="lg" variant="outline" onClick={handleRetake} className="min-w-40" disabled={isProcessing}>
                            Retake
                        </Button>
                        <Button size="lg" onClick={handleFindMatch} className="min-w-40" disabled={isProcessing}>
                            {isProcessing ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                                    <span>Searching...</span>
                                </div>
                            ) : (
                                "Find Memory"
                            )}
                        </Button>
                    </div>

                    <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Click "Find Memory" to search for this object in your saved memories.
                        </p>
                    </div>
                </>
            )}

            {/* Mode: Result (Show match result) */}
            {mode === "result" && matchResult && (
                <>
                    {/* Current Photo */}
                    <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted/30 shadow-lg sm:h-[350px] sm:w-[350px]">
                        {capturedImage && (
                            <img
                                src={`data:image/png;base64,${capturedImage}`}
                                alt="Captured object"
                                className="h-full w-full object-cover"
                            />
                        )}
                    </div>

                    {/* Description of current photo */}
                    {matchResult.description && (
                        <div className="w-full max-w-md">
                            <label className="mb-2 block text-sm font-medium text-muted-foreground">This Object</label>
                            <div className="rounded-lg border border-border bg-muted/30 p-4 text-foreground">
                                {matchResult.description}
                            </div>
                        </div>
                    )}

                    {/* Match Result */}
                    {matchResult.matched && matchResult.matchedRecord ? (
                        <div className="w-full max-w-md space-y-4">
                            <div className="rounded-lg border-2 border-green-500 bg-green-500/10 p-4 text-center">
                                <span className="text-2xl">✨</span>
                                <p className="mt-2 text-lg font-semibold text-green-600 dark:text-green-400">
                                    Memory Found!
                                </p>
                                {matchResult.confidence && (
                                    <p className="text-sm text-muted-foreground">
                                        Confidence: {matchResult.confidence}
                                    </p>
                                )}
                            </div>

                            {/* Matched object image */}
                            {matchResult.matchedRecord.object_image_base64 && (
                                <div className="flex flex-col items-center">
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Matched Object</label>
                                    <div className="relative h-[200px] w-[200px] overflow-hidden rounded-xl border border-border shadow-md">
                                        <img
                                            src={`data:image/png;base64,${matchResult.matchedRecord.object_image_base64}`}
                                            alt="Matched object"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Matched memory */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-muted-foreground">The Memory</label>
                                <div className="rounded-lg border border-border bg-muted/30 p-4 text-foreground italic">
                                    "{matchResult.matchedMemory}"
                                </div>
                            </div>

                            {/* Match reason */}
                            {matchResult.reason && (
                                <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                                    <strong>Why it matched:</strong> {matchResult.reason}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full max-w-md">
                            <div className="rounded-lg border-2 border-orange-500 bg-orange-500/10 p-6 text-center">
                                <span className="text-4xl">🤔</span>
                                <p className="mt-3 text-lg font-semibold text-orange-600 dark:text-orange-400">
                                    No matching object found
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    This object doesn't match any of your saved memories. Try capturing this object on the Capture page first, or try again with a different photo.
                                </p>
                                {matchResult.reason && (
                                    <p className="mt-3 text-xs text-muted-foreground italic">
                                        {matchResult.reason}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <Button size="lg" onClick={handleTryAgain} className="min-w-40">
                        Try Another Object
                    </Button>
                </>
            )}
        </div>
    )
}
