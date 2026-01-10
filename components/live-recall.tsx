"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LiveClient } from "@/lib/live-api/live-client"
import { AudioRecorder } from "@/lib/live-api/audio-recorder"
import { AudioStreamer } from "@/lib/live-api/audio-streamer"
import { getSupabaseClient } from "@/lib/supabase/client"

type LiveRecallState = "idle" | "connecting" | "listening" | "processing" | "speaking" | "error"

interface MemoryRecord {
    id: number
    object_description: string
    object_memory: string
}

export function LiveRecall() {
    const [state, setState] = useState<LiveRecallState>("idle")
    const [statusMessage, setStatusMessage] = useState("Click Start to begin live recall")
    const [transcript, setTranscript] = useState<string[]>([])
    const [inputVolume, setInputVolume] = useState(0)
    const [outputVolume, setOutputVolume] = useState(0)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const clientRef = useRef<LiveClient | null>(null)
    const recorderRef = useRef<AudioRecorder | null>(null)
    const streamerRef = useRef<AudioStreamer | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const memoriesRef = useRef<MemoryRecord[]>([])

    // Fetch all memories from database on mount
    useEffect(() => {
        const fetchMemories = async () => {
            const supabase = getSupabaseClient()
            const { data, error } = await supabase
                .from("object_memories")
                .select("id, object_description, object_memory")
                .neq("object_description", "")
                .order("created_at", { ascending: false })

            if (!error && data) {
                memoriesRef.current = data
                console.log(`Loaded ${data.length} memories for matching`)
            }
        }
        fetchMemories()
    }, [])

    const addTranscript = useCallback((text: string) => {
        setTranscript(prev => [...prev.slice(-9), text])
    }, [])

    const captureVideoFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null

        const video = videoRef.current
        const canvas = canvasRef.current

        // Scale down to 25% for efficiency
        const width = video.videoWidth * 0.25
        const height = video.videoHeight * 0.25

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) return null

        ctx.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
        return dataUrl.split(",")[1] // Return base64 data only
    }, [])

    const buildSystemPrompt = useCallback(() => {
        const memoriesList = memoriesRef.current.map((m, i) =>
            `[${i}] Description: "${m.object_description}" | Memory: "${m.object_memory}"`
        ).join("\n\n")

        return `You are a helpful assistant for an object memory recall application called Everbloom.

Your job is to:
1. Wait for the user to say a trigger phrase like "what is this?", "tell me about this", "remember this", or similar
2. When triggered, analyze the current video frame to identify the main object
3. Compare the object to the saved memories listed below
4. If you find a matching object (same physical item based on specific details, not just same type), speak the associated memory in a warm, nostalgic tone
5. If no match is found, kindly tell the user you don't recognize this object and suggest they capture it first

CRITICAL MATCHING RULES:
- You must match the SAME physical object, not just similar objects of the same type
- Two coffee mugs are NOT a match unless they have the same specific details
- Look for matching colors, materials, wear patterns, unique features, distinguishing marks

SAVED MEMORIES DATABASE:
${memoriesList || "(No memories saved yet)"}

BEHAVIOR:
- Be conversational and warm
- When you find a match, say something like "Ah, I remember this one..." and then share the memory
- When no match is found, say something like "I don't recognize this object yet. Would you like to capture it first?"
- Keep responses concise but emotionally resonant
- Focus ONLY on the main object, ignore hands, background, and other items`
    }, [])

    const startLiveRecall = useCallback(async () => {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
        if (!apiKey) {
            setState("error")
            setStatusMessage("Gemini API key not configured")
            return
        }

        setState("connecting")
        setStatusMessage("Connecting to Gemini Live API...")

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
                setState("listening")
                setStatusMessage("Listening... Say 'what is this?' while showing an object")
                addTranscript("🟢 Connected to Gemini Live API")
            })

            clientRef.current.on("audio", (base64Audio) => {
                streamerRef.current?.addPCM16(base64Audio)
                setState("speaking")
            })

            clientRef.current.on("content", (text) => {
                addTranscript(`🤖 ${text}`)
            })

            clientRef.current.on("turncomplete", () => {
                setState("listening")
                setStatusMessage("Listening... Say 'what is this?' while showing an object")
            })

            clientRef.current.on("interrupted", () => {
                streamerRef.current?.stop()
                setState("listening")
            })

            clientRef.current.on("error", (error) => {
                console.error("Live API error:", error)
                addTranscript(`❌ Error: ${error.message}`)
            })

            clientRef.current.on("close", () => {
                setState("idle")
                setStatusMessage("Disconnected")
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
                const frame = captureVideoFrame()
                if (frame && clientRef.current?.connected) {
                    clientRef.current.sendRealtimeInput([
                        { mimeType: "image/jpeg", data: frame }
                    ])
                }
            }, 500)

        } catch (error) {
            console.error("Failed to start live recall:", error)
            setState("error")
            setStatusMessage(error instanceof Error ? error.message : "Failed to connect")
        }
    }, [buildSystemPrompt, captureVideoFrame, addTranscript])

    const stopLiveRecall = useCallback(() => {
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

        setState("idle")
        setStatusMessage("Click Start to begin live recall")
        setInputVolume(0)
        setOutputVolume(0)
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopLiveRecall()
        }
    }, [stopLiveRecall])

    const getStateColor = () => {
        switch (state) {
            case "listening": return "bg-green-500"
            case "processing": return "bg-yellow-500"
            case "speaking": return "bg-blue-500"
            case "connecting": return "bg-orange-500"
            case "error": return "bg-red-500"
            default: return "bg-gray-500"
        }
    }

    const getStateLabel = () => {
        switch (state) {
            case "listening": return "Listening"
            case "processing": return "Thinking..."
            case "speaking": return "Speaking"
            case "connecting": return "Connecting..."
            case "error": return "Error"
            default: return "Idle"
        }
    }

    return (
        <div className="flex flex-col items-center gap-6 sm:gap-8">
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Display */}
            <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-black shadow-lg sm:h-[350px] sm:w-[350px]">
                {state === "idle" ? (
                    <div className="flex flex-col items-center gap-4 p-8 text-center">
                        <span className="text-6xl">🎥</span>
                        <p className="text-lg font-medium text-white/70">
                            Live video recall
                        </p>
                    </div>
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
                {state !== "idle" && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5">
                        <div className={`h-3 w-3 rounded-full ${getStateColor()} animate-pulse`} />
                        <span className="text-sm font-medium text-white">{getStateLabel()}</span>
                    </div>
                )}
            </div>

            {/* Status Message */}
            <div className="text-center">
                <p className="text-lg text-muted-foreground">{statusMessage}</p>
            </div>

            {/* Volume Meters */}
            {state !== "idle" && (
                <div className="flex w-full max-w-md gap-4">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs text-muted-foreground">Mic Input</label>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-green-500 transition-all duration-75"
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
                {state === "idle" ? (
                    <Button size="lg" onClick={startLiveRecall} className="min-w-40">
                        Start Live Recall
                    </Button>
                ) : (
                    <Button size="lg" variant="destructive" onClick={stopLiveRecall} className="min-w-40">
                        Stop
                    </Button>
                )}
            </div>

            {/* Instructions */}
            <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                    {state === "idle" ? (
                        <>Start live recall to use your camera and microphone. Point your camera at an object and say <strong>"what is this?"</strong> to recall its memory.</>
                    ) : (
                        <>Show an object to the camera and ask <strong>"what is this?"</strong> or <strong>"tell me about this"</strong> to hear its memory.</>
                    )}
                </p>
            </div>

            {/* Transcript */}
            {transcript.length > 0 && (
                <div className="mt-4 w-full max-w-md">
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">Activity Log</h3>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                        {transcript.map((text, i) => (
                            <p key={i} className="text-sm text-foreground py-1 border-b border-border/50 last:border-0">
                                {text}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
