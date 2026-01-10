"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LiveClient } from "@/lib/live-api/live-client"
import { AudioRecorder } from "@/lib/live-api/audio-recorder"
import { AudioStreamer } from "@/lib/live-api/audio-streamer"
import { getSupabaseClient } from "@/lib/supabase/client"

type LiveCaptureState = "idle" | "connecting" | "scanning" | "recording" | "processing" | "speaking" | "saved" | "error"

interface CapturedObject {
    imageBase64: string
    description: string
}

interface CapturedMemory {
    imageBase64: string
    description: string
    memory: string
}

// Audio context for playing capture tone
let audioContext: AudioContext | null = null

function playCaptureTone() {
    try {
        if (!audioContext) {
            audioContext = new AudioContext()
        }

        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        // Pleasant two-tone chime
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
        oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1) // C#6

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
    } catch (e) {
        console.error("Failed to play capture tone:", e)
    }
}

export function LiveCapture() {
    const [state, setState] = useState<LiveCaptureState>("idle")
    const [statusMessage, setStatusMessage] = useState("Click Start to begin capturing")
    const [inputVolume, setInputVolume] = useState(0)
    const [outputVolume, setOutputVolume] = useState(0)
    const [capturedMemory, setCapturedMemory] = useState<CapturedMemory | null>(null)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [objectCaptured, setObjectCaptured] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const prevCanvasRef = useRef<HTMLCanvasElement>(null)
    const clientRef = useRef<LiveClient | null>(null)
    const recorderRef = useRef<AudioRecorder | null>(null)
    const streamerRef = useRef<AudioStreamer | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const capturedObjectRef = useRef<CapturedObject | null>(null)
    const previousFrameDataRef = useRef<ImageData | null>(null)
    const stableFrameCountRef = useRef(0)

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

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext("2d")
        if (!ctx) return null

        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL("image/png")
        return dataUrl.split(",")[1]
    }, [])

    const captureSmallFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null

        const video = videoRef.current
        const canvas = canvasRef.current

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

    // Check if frame is stable (not shaky) by comparing with previous frame
    const isFrameStable = useCallback((): boolean => {
        if (!videoRef.current || !prevCanvasRef.current) return false

        const video = videoRef.current
        const canvas = prevCanvasRef.current

        // Use small resolution for comparison
        const width = 64
        const height = 48

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) return false

        ctx.drawImage(video, 0, 0, width, height)
        const currentFrameData = ctx.getImageData(0, 0, width, height)

        if (!previousFrameDataRef.current) {
            previousFrameDataRef.current = currentFrameData
            return false
        }

        // Calculate difference between frames
        let totalDiff = 0
        const data1 = previousFrameDataRef.current.data
        const data2 = currentFrameData.data

        for (let i = 0; i < data1.length; i += 4) {
            // Compare RGB values (skip alpha)
            totalDiff += Math.abs(data1[i] - data2[i])
            totalDiff += Math.abs(data1[i + 1] - data2[i + 1])
            totalDiff += Math.abs(data1[i + 2] - data2[i + 2])
        }

        const avgDiff = totalDiff / (width * height * 3)
        previousFrameDataRef.current = currentFrameData

        // If average pixel difference is low, frame is stable
        // Threshold of 5 means very little movement
        return avgDiff < 5
    }, [])

    const buildSystemPrompt = useCallback((hasObjectCapture: boolean) => {
        if (hasObjectCapture) {
            // After object is captured, just transcribe memory
            return `You are an assistant for a memory capture application called Everbloom.

The object has already been captured. Your ONLY job now is to:
1. Listen to the user speaking their memory about the object
2. When they say "done", "save", "that's it", or similar, transcribe what they said

When the user signals they're done, respond with EXACTLY this JSON format:
{
  "memory": "exact transcription of what the user said about their memory"
}

While recording, you can acknowledge briefly like "I'm listening" but keep it very short.
Do NOT generate or make up memories - ONLY transcribe what the user actually said.
IMPORTANT: Only output the JSON when the user explicitly says they're done.`
        } else {
            // Before object capture, analyze video for clear object
            return `You are an assistant for a memory capture application called Everbloom.

Your job is to analyze video frames and identify when there's a clear, stable view of an object.

When you see a clear, well-lit, in-focus object that's not moving/shaky, respond with EXACTLY this JSON:
{
  "objectDetected": true,
  "description": "detailed 2-3 sentence description of the object's physical characteristics"
}

CRITICAL INSTRUCTIONS:
- Focus ONLY on the main object, ignore hands, background, and other items
- Describe colors, materials, textures, wear patterns, distinguishing features
- Only respond with JSON when the object view is clear and stable
- If the image is blurry, dark, or moving too much, stay silent`
        }
    }, [])

    const generateDescription = useCallback(async (imageBase64: string): Promise<string | null> => {
        try {
            const response = await fetch("/api/analyze-object", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64 })
            })

            if (!response.ok) return null

            const data = await response.json()
            return data.description || null
        } catch (e) {
            console.error("Failed to generate description:", e)
            return null
        }
    }, [])

    const startLiveCapture = useCallback(async () => {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
        if (!apiKey) {
            setState("error")
            setStatusMessage("Gemini API key not configured")
            return
        }

        setState("connecting")
        setStatusMessage("Connecting...")
        capturedObjectRef.current = null
        previousFrameDataRef.current = null
        stableFrameCountRef.current = 0
        setObjectCaptured(false)
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
                setState("scanning")
                setStatusMessage("Hold the object steady in frame...")
            })

            clientRef.current.on("audio", (base64Audio) => {
                streamerRef.current?.addPCM16(base64Audio)
            })

            clientRef.current.on("content", (text) => {
                console.log("Received content:", text)

                // Check for memory transcription (after object captured)
                const memoryMatch = text.match(/\{[\s\S]*"memory"[\s\S]*\}/)
                if (memoryMatch && capturedObjectRef.current) {
                    try {
                        const data = JSON.parse(memoryMatch[0])
                        if (data.memory) {
                            setCapturedMemory({
                                imageBase64: capturedObjectRef.current.imageBase64,
                                description: capturedObjectRef.current.description,
                                memory: data.memory
                            })
                            setState("saved")
                            setStatusMessage("Memory captured! Review and save below.")
                            stopLiveCapture(false)
                        }
                    } catch (e) {
                        console.error("Failed to parse memory JSON:", e)
                    }
                }
            })

            clientRef.current.on("turncomplete", () => {
                if (state === "scanning") {
                    // Still scanning for object
                } else if (capturedObjectRef.current && state !== "saved") {
                    setState("recording")
                }
            })

            clientRef.current.on("interrupted", () => {
                streamerRef.current?.stop()
            })

            clientRef.current.on("error", (error) => {
                console.error("Live API error:", error)
                setState("error")
                setStatusMessage(`Error: ${error.message}`)
            })

            clientRef.current.on("close", () => {
                if (state !== "saved" && state !== "error") {
                    setState("idle")
                    setStatusMessage("Disconnected")
                }
            })

            // Connect to Gemini Live API
            await clientRef.current.connect({
                model: "gemini-2.0-flash-exp",
                systemInstruction: buildSystemPrompt(false)
            })

            // Start audio recording
            recorderRef.current.on("data", (base64Audio) => {
                if (capturedObjectRef.current) {
                    // Only send audio after object is captured
                    clientRef.current?.sendRealtimeInput([
                        { mimeType: "audio/pcm;rate=16000", data: base64Audio }
                    ])
                }
            })
            await recorderRef.current.start()

            // Start frame analysis loop
            frameIntervalRef.current = setInterval(async () => {
                if (!clientRef.current?.connected) return

                // Check frame stability
                const stable = isFrameStable()

                if (stable) {
                    stableFrameCountRef.current++
                } else {
                    stableFrameCountRef.current = 0
                }

                // If we haven't captured an object yet
                if (!capturedObjectRef.current) {
                    // Send frame to Gemini for analysis
                    const smallFrame = captureSmallFrame()
                    if (smallFrame) {
                        clientRef.current?.sendRealtimeInput([
                            { mimeType: "image/jpeg", data: smallFrame }
                        ])
                    }

                    // If frame has been stable for 1.5 seconds (3 frames at 500ms), capture it
                    if (stableFrameCountRef.current >= 3) {
                        const fullFrame = captureVideoFrame()
                        if (fullFrame) {
                            // Generate description using existing API
                            const description = await generateDescription(fullFrame)

                            if (description) {
                                capturedObjectRef.current = {
                                    imageBase64: fullFrame,
                                    description: description
                                }
                                setObjectCaptured(true)

                                // Play capture tone
                                playCaptureTone()

                                // Update state and prompt
                                setState("recording")
                                setStatusMessage("Object captured! Now speak your memory. Say 'done' when finished.")

                                // Reconnect with new prompt for memory transcription
                                clientRef.current?.disconnect()
                                await clientRef.current?.connect({
                                    model: "gemini-2.0-flash-exp",
                                    systemInstruction: buildSystemPrompt(true)
                                })
                            }
                        }
                    }
                }
            }, 500)

        } catch (error) {
            console.error("Failed to start live capture:", error)
            setState("error")
            setStatusMessage(error instanceof Error ? error.message : "Failed to connect")
        }
    }, [buildSystemPrompt, captureVideoFrame, captureSmallFrame, isFrameStable, generateDescription, state])

    const stopLiveCapture = useCallback((resetState = true) => {
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current)
            frameIntervalRef.current = null
        }

        recorderRef.current?.stop()
        recorderRef.current = null

        streamerRef.current?.close()
        streamerRef.current = null

        clientRef.current?.disconnect()
        clientRef.current = null

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }

        if (resetState) {
            setState("idle")
            setStatusMessage("Click Start to begin capturing")
            setObjectCaptured(false)
            capturedObjectRef.current = null
        }
        setInputVolume(0)
        setOutputVolume(0)
    }, [])

    const handleStopRecording = useCallback(() => {
        if (!capturedObjectRef.current) {
            // No object was captured
            setState("error")
            setStatusMessage("No clear object was detected. Please try again and hold the object steady.")
            stopLiveCapture(false)
            setTimeout(() => {
                setState("idle")
                setStatusMessage("Click Start to begin capturing")
            }, 3000)
        } else {
            // Object captured but user stopped early - tell them to say "done"
            setStatusMessage("Say 'done' or 'save' to finish recording your memory.")
        }
    }, [stopLiveCapture])

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
                setObjectCaptured(false)
                capturedObjectRef.current = null
            }
        } catch (error) {
            console.error("Error saving memory:", error)
            setState("error")
            setStatusMessage("Failed to save memory")
        }
    }, [capturedMemory, sessionId])

    const discardMemory = useCallback(() => {
        setCapturedMemory(null)
        setObjectCaptured(false)
        capturedObjectRef.current = null
        setState("idle")
        setStatusMessage("Click Start to begin capturing")
    }, [])

    useEffect(() => {
        return () => {
            stopLiveCapture()
        }
    }, [stopLiveCapture])

    const getStateColor = () => {
        switch (state) {
            case "scanning": return "bg-yellow-500"
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
            case "scanning": return "Scanning..."
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
            {/* Hidden canvases for frame capture and comparison */}
            <canvas ref={canvasRef} className="hidden" />
            <canvas ref={prevCanvasRef} className="hidden" />

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
                        <div className={`h-3 w-3 rounded-full ${getStateColor()} ${(state === "recording" || state === "scanning") ? "animate-pulse" : ""}`} />
                        <span className="text-sm font-medium text-white">{getStateLabel()}</span>
                    </div>
                )}

                {/* Object captured indicator */}
                {objectCaptured && !capturedMemory && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-green-500/90 px-3 py-1.5">
                        <span className="text-sm font-medium text-white">Object Captured</span>
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
            {(state === "recording" || state === "speaking" || state === "scanning") && (
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
                ) : state === "idle" || state === "error" ? (
                    <Button size="lg" onClick={startLiveCapture} className="min-w-40">
                        Start Recording
                    </Button>
                ) : (
                    <Button size="lg" variant="destructive" onClick={handleStopRecording} className="min-w-40">
                        {objectCaptured ? "Finish" : "Cancel"}
                    </Button>
                )}
            </div>

            {/* Instructions */}
            <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                    {state === "idle" && !capturedMemory ? (
                        <>Start recording, then <strong>hold an object steady</strong> until you hear a tone. Then <strong>speak your memory</strong> and say <strong>"done"</strong> when finished.</>
                    ) : state === "scanning" ? (
                        <>Hold the object <strong>steady and in focus</strong>. A tone will play when captured.</>
                    ) : state === "recording" && objectCaptured ? (
                        <>Object captured! <strong>Speak your memory</strong> now. Say <strong>"done"</strong> when finished.</>
                    ) : capturedMemory ? (
                        <>Review the captured memory above. Click <strong>Save</strong> to keep it or <strong>Discard</strong> to try again.</>
                    ) : (
                        <>Hold the object steady in frame...</>
                    )}
                </p>
            </div>
        </div>
    )
}
