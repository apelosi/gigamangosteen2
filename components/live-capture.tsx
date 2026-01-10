"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LiveClient } from "@/lib/live-api/live-client"
import { AudioRecorder } from "@/lib/live-api/audio-recorder"
import { AudioStreamer } from "@/lib/live-api/audio-streamer"
import { getSupabaseClient } from "@/lib/supabase/client"

type LiveCaptureState = "idle" | "connecting" | "recording" | "processing" | "speaking" | "saved" | "error"

interface CapturedMemory {
    imageBase64: string
    description: string
    memory: string
}

export function LiveCapture() {
    const [state, setState] = useState<LiveCaptureState>("idle")
    const [statusMessage, setStatusMessage] = useState("Click Start to begin capturing")
    const [inputVolume, setInputVolume] = useState(0)
    const [outputVolume, setOutputVolume] = useState(0)
    const [capturedMemory, setCapturedMemory] = useState<CapturedMemory | null>(null)
    const [sessionId, setSessionId] = useState<string | null>(null)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const clientRef = useRef<LiveClient | null>(null)
    const recorderRef = useRef<AudioRecorder | null>(null)
    const streamerRef = useRef<AudioStreamer | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const capturedFrameRef = useRef<string | null>(null)
    const transcribedTextRef = useRef<string>("")

    // Initialize session ID on mount
    useEffect(() => {
        let existingSessionId = sessionStorage.getItem("kitchen_memory_session_id")
        if (!existingSessionId) {
            existingSessionId = crypto.randomUUID()
            sessionStorage.setItem("kitchen_memory_session_id", existingSessionId)
        }
        setSessionId(existingSessionId)
    }, [])

    const captureVideoFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null

        const video = videoRef.current
        const canvas = canvasRef.current

        // Capture at full resolution for saving
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext("2d")
        if (!ctx) return null

        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL("image/png")
        return dataUrl.split(",")[1] // Return base64 data only
    }, [])

    const captureSmallFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null

        const video = videoRef.current
        const canvas = canvasRef.current

        // Scale down to 25% for streaming efficiency
        const width = video.videoWidth * 0.25
        const height = video.videoHeight * 0.25

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) return null

        ctx.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
        return dataUrl.split(",")[1]
    }, [])

    const buildSystemPrompt = useCallback(() => {
        return `You are an assistant for a memory capture application called Everbloom.

Your job is to help users capture memories of objects. Here's how it works:

1. The user will show you an object via the camera
2. The user will speak their memory associated with that object
3. When the user says "save" or "done" or "that's it" or similar, you will:
   - Analyze the video to identify and describe the main object
   - Transcribe what the user said as their memory

CRITICAL INSTRUCTIONS:
- Focus ONLY on the main object in the video, ignore hands, background, and other items
- Describe the object's physical characteristics: colors, materials, textures, wear patterns, distinguishing features
- The memory transcription should capture EXACTLY what the user said about their memory, not a summary
- Keep the object description to 2-3 sentences
- Do NOT generate or make up memories - only transcribe what the user actually said

When the user signals they're done (says "save", "done", "that's it", etc.), respond with EXACTLY this JSON format and nothing else:
{
  "description": "detailed description of the object",
  "memory": "exact transcription of what the user said about their memory"
}

While recording, you can acknowledge the user with brief responses like "I see the object" or "Keep going, I'm listening" but keep these very short.

IMPORTANT: Only output the JSON when the user explicitly says they're done. Until then, just listen and acknowledge briefly.`
    }, [])

    const startLiveCapture = useCallback(async () => {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
        if (!apiKey) {
            setState("error")
            setStatusMessage("Gemini API key not configured")
            return
        }

        setState("connecting")
        setStatusMessage("Connecting to Gemini Live API...")
        transcribedTextRef.current = ""
        capturedFrameRef.current = null
        setCapturedMemory(null)

        try {
            // Start camera
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            })
            streamRef.current = mediaStream

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
            }

            // Initialize audio streamer for output
            streamerRef.current = new AudioStreamer(24000)
            streamerRef.current.on("volume", setOutputVolume)
            await streamerRef.current.resume()

            // Initialize audio recorder for input
            recorderRef.current = new AudioRecorder(16000)
            recorderRef.current.on("volume", setInputVolume)

            // Initialize live client
            clientRef.current = new LiveClient(apiKey)

            clientRef.current.on("open", () => {
                setState("recording")
                setStatusMessage("Recording... Show object and speak your memory. Say 'save' when done.")
            })

            clientRef.current.on("audio", (base64Audio) => {
                streamerRef.current?.addPCM16(base64Audio)
                if (state !== "processing") {
                    setState("speaking")
                }
            })

            clientRef.current.on("content", (text) => {
                console.log("Received content:", text)

                // Check if the response contains JSON with description and memory
                const jsonMatch = text.match(/\{[\s\S]*"description"[\s\S]*"memory"[\s\S]*\}/)
                if (jsonMatch) {
                    try {
                        const data = JSON.parse(jsonMatch[0])
                        if (data.description && data.memory) {
                            // Capture the current frame for saving
                            const frameBase64 = captureVideoFrame()
                            if (frameBase64) {
                                setCapturedMemory({
                                    imageBase64: frameBase64,
                                    description: data.description,
                                    memory: data.memory
                                })
                                setState("saved")
                                setStatusMessage("Memory captured! Review and save below.")

                                // Stop the live session
                                stopLiveCapture(false)
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse JSON:", e)
                    }
                }
            })

            clientRef.current.on("turncomplete", () => {
                if (state !== "saved") {
                    setState("recording")
                }
            })

            clientRef.current.on("interrupted", () => {
                streamerRef.current?.stop()
                if (state !== "saved") {
                    setState("recording")
                }
            })

            clientRef.current.on("error", (error) => {
                console.error("Live API error:", error)
                setState("error")
                setStatusMessage(`Error: ${error.message}`)
            })

            clientRef.current.on("close", () => {
                if (state !== "saved") {
                    setState("idle")
                    setStatusMessage("Disconnected")
                }
            })

            // Connect to Gemini Live API
            await clientRef.current.connect({
                model: "gemini-2.0-flash-exp",
                systemInstruction: buildSystemPrompt()
            })

            // Start audio recording
            recorderRef.current.on("data", (base64Audio) => {
                clientRef.current?.sendRealtimeInput([
                    { mimeType: "audio/pcm;rate=16000", data: base64Audio }
                ])
            })
            await recorderRef.current.start()

            // Start sending video frames (2 FPS)
            frameIntervalRef.current = setInterval(() => {
                const frame = captureSmallFrame()
                if (frame && clientRef.current?.connected) {
                    clientRef.current.sendRealtimeInput([
                        { mimeType: "image/jpeg", data: frame }
                    ])
                    // Keep track of latest frame for potential capture
                    capturedFrameRef.current = captureVideoFrame()
                }
            }, 500)

        } catch (error) {
            console.error("Failed to start live capture:", error)
            setState("error")
            setStatusMessage(error instanceof Error ? error.message : "Failed to connect")
        }
    }, [buildSystemPrompt, captureVideoFrame, captureSmallFrame, state])

    const stopLiveCapture = useCallback((resetState = true) => {
        // Stop frame capture
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current)
            frameIntervalRef.current = null
        }

        // Stop audio recorder
        recorderRef.current?.stop()
        recorderRef.current = null

        // Stop audio streamer
        streamerRef.current?.close()
        streamerRef.current = null

        // Disconnect client
        clientRef.current?.disconnect()
        clientRef.current = null

        // Stop camera
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }

        if (resetState) {
            setState("idle")
            setStatusMessage("Click Start to begin capturing")
        }
        setInputVolume(0)
        setOutputVolume(0)
    }, [])

    const saveMemory = useCallback(async () => {
        if (!capturedMemory || !sessionId) return

        setState("processing")
        setStatusMessage("Saving memory...")

        try {
            const supabase = getSupabaseClient()
            const { error } = await supabase
                .from("object_memories")
                .insert({
                    session_id: sessionId,
                    object_image_base64: capturedMemory.imageBase64,
                    object_description: capturedMemory.description,
                    object_memory: capturedMemory.memory,
                })

            if (error) {
                console.error("Error saving memory:", error)
                setState("error")
                setStatusMessage("Failed to save memory")
            } else {
                setState("idle")
                setStatusMessage("Memory saved! Click Start to capture another.")
                setCapturedMemory(null)
            }
        } catch (error) {
            console.error("Error saving memory:", error)
            setState("error")
            setStatusMessage("Failed to save memory")
        }
    }, [capturedMemory, sessionId])

    const discardMemory = useCallback(() => {
        setCapturedMemory(null)
        setState("idle")
        setStatusMessage("Click Start to begin capturing")
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopLiveCapture()
        }
    }, [stopLiveCapture])

    const getStateColor = () => {
        switch (state) {
            case "recording": return "bg-red-500"
            case "processing": return "bg-yellow-500"
            case "speaking": return "bg-blue-500"
            case "connecting": return "bg-orange-500"
            case "saved": return "bg-green-500"
            case "error": return "bg-red-500"
            default: return "bg-gray-500"
        }
    }

    const getStateLabel = () => {
        switch (state) {
            case "recording": return "Recording"
            case "processing": return "Processing..."
            case "speaking": return "AI Speaking"
            case "connecting": return "Connecting..."
            case "saved": return "Captured!"
            case "error": return "Error"
            default: return "Ready"
        }
    }

    return (
        <div className="flex flex-col items-center gap-6 sm:gap-8">
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Display or Captured Image */}
            <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-black shadow-lg sm:h-[350px] sm:w-[350px]">
                {state === "idle" && !capturedMemory ? (
                    <div className="flex flex-col items-center gap-4 p-8 text-center">
                        <span className="text-6xl">🎙️</span>
                        <p className="text-lg font-medium text-white/70">
                            Live voice capture
                        </p>
                    </div>
                ) : capturedMemory ? (
                    <img
                        src={`data:image/png;base64,${capturedMemory.imageBase64}`}
                        alt="Captured object"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                    />
                )}

                {/* State indicator */}
                {state !== "idle" && !capturedMemory && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5">
                        <div className={`h-3 w-3 rounded-full ${getStateColor()} ${state === "recording" ? "animate-pulse" : ""}`} />
                        <span className="text-sm font-medium text-white">{getStateLabel()}</span>
                    </div>
                )}
            </div>

            {/* Status Message */}
            <div className="text-center">
                <p className="text-lg text-muted-foreground">{statusMessage}</p>
            </div>

            {/* Captured Memory Preview */}
            {capturedMemory && (
                <div className="w-full max-w-md space-y-4">
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">Object Description</label>
                        <p className="text-foreground">{capturedMemory.description}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">Your Memory</label>
                        <p className="text-foreground italic">"{capturedMemory.memory}"</p>
                    </div>
                </div>
            )}

            {/* Volume Meters */}
            {(state === "recording" || state === "speaking") && (
                <div className="flex w-full max-w-md gap-4">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs text-muted-foreground">Mic Input</label>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-red-500 transition-all duration-75"
                                style={{ width: `${inputVolume * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="mb-1 block text-xs text-muted-foreground">Audio Output</label>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-75"
                                style={{ width: `${outputVolume * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-4">
                {capturedMemory ? (
                    <>
                        <Button size="lg" variant="outline" onClick={discardMemory} className="min-w-32">
                            Discard
                        </Button>
                        <Button size="lg" onClick={saveMemory} className="min-w-32">
                            Save Memory
                        </Button>
                    </>
                ) : state === "idle" ? (
                    <Button size="lg" onClick={startLiveCapture} className="min-w-40">
                        Start Recording
                    </Button>
                ) : (
                    <Button size="lg" variant="destructive" onClick={() => stopLiveCapture(true)} className="min-w-40">
                        Cancel
                    </Button>
                )}
            </div>

            {/* Instructions */}
            <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                    {state === "idle" && !capturedMemory ? (
                        <>Start recording to use your camera and microphone. Show an object and <strong>speak your memory</strong> about it. Say <strong>"save"</strong> when done.</>
                    ) : capturedMemory ? (
                        <>Review the captured memory above. Click <strong>Save</strong> to keep it or <strong>Discard</strong> to try again.</>
                    ) : (
                        <>Show the object clearly and speak your memory. When finished, say <strong>"save"</strong> or <strong>"done"</strong>.</>
                    )}
                </p>
            </div>
        </div>
    )
}
