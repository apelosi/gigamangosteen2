"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LiveClient } from "@/lib/live-api/live-client"
import { AudioRecorder } from "@/lib/live-api/audio-recorder"
import { AudioStreamer } from "@/lib/live-api/audio-streamer"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Modality } from "@google/genai"

// Simplified states for cleaner flow
type LiveCaptureState = "idle" | "scanning" | "recording" | "saving"

// Debug flag - set to true to see stability metrics in console
const DEBUG_STABILITY = true

// Stability settings - lower threshold and fewer frames needed
const STABILITY_THRESHOLD = 35  // Higher = more lenient (was 20)
const STABLE_FRAMES_REQUIRED = 2  // Fewer frames needed (was 3)

interface CapturedObject {
    imageBase64: string
    description: string
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
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [stabilityProgress, setStabilityProgress] = useState(0)
    const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null)
    const [transcribedMemory, setTranscribedMemory] = useState<string>("")
    const [inputVolume, setInputVolume] = useState(0)
    const [outputVolume, setOutputVolume] = useState(0)
    const transcribedMemoryRef = useRef<string>("")
    const transcriptBufferRef = useRef<string>("")

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
    const processingCaptureRef = useRef(false)

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

        if (DEBUG_STABILITY) {
            console.log(`Frame stability: avgDiff=${avgDiff.toFixed(2)}, stable=${avgDiff < STABILITY_THRESHOLD}`)
        }

        return avgDiff < STABILITY_THRESHOLD
    }, [])

    const scanningTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // ...

    const buildSystemPrompt = useCallback((hasObjectCapture: boolean) => {
        if (hasObjectCapture) {
            return `You are a friendly memory companion.
            
Phase 1: ACKNOWLEDGE
- I will send you a text saying what object was captured.
- You must immediately Say: "That's a [object], what does this remind you of?"
- Do not add anything else.

Phase 2: LISTEN & TRANSCRIBE
- After speaking, listen to the user.
- Your PRIMARY GOAL is to output the user's speech as a JSON field "memory".
- Output JSON updates frequently: {"memory": "current transcript..."}
- If you cannot output JSON, just output the plain text of what the user says.
- Do NOT continue the conversation. Do NOT ask more questions. Just listen and transcribe.`
        } else {
            return `You are a camera assistant.
1. VOICE COMMANDS: If I send you text starting with "Say", you must speak that exact phrase immediately.
2. OBJECT DETECTION: Otherwise, analyze video frames. When you see a clear, stable object, respond with JSON:
{ "objectDetected": true, "description": "..." }
If the image is blurry or unstable, stay silent.`
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

    const stopLiveCapture = useCallback((resetAll = true) => {
        if (scanningTimeoutRef.current) {
            clearTimeout(scanningTimeoutRef.current)
            scanningTimeoutRef.current = null
        }
        if (frameIntervalRef.current) {
            // ...
        }
    }, [])

    const startLiveCapture = useCallback(async () => {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
        if (!apiKey) {
            alert("Gemini API key not configured")
            return
        }

        // Reset everything
        if (scanningTimeoutRef.current) clearTimeout(scanningTimeoutRef.current)
        capturedObjectRef.current = null
        previousFrameDataRef.current = null
        stableFrameCountRef.current = 0
        processingCaptureRef.current = false
        setStabilityProgress(0)
        setCapturedImagePreview(null)
        setTranscribedMemory("")
        transcribedMemoryRef.current = ""
        setState("scanning")

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

            clientRef.current.on("content", (text) => {
                console.log("Received content chunk:", text)

                // Accumulate all text
                if (capturedObjectRef.current) {
                    transcriptBufferRef.current += text
                    const fullText = transcriptBufferRef.current

                    // 1. Try to find the structured JSON memory
                    const memoryMatch = fullText.match(/"memory"\s*:\s*"((?:[^"\\]|\\.)*)"/);

                    if (memoryMatch && memoryMatch[1]) {
                        const memoryText = memoryMatch[1];
                        console.log("Extracted memory JSON:", memoryText)
                        transcribedMemoryRef.current = memoryText
                        setTranscribedMemory(memoryText)
                    } else {
                        // 2. Strong Fallback: If no JSON structure is found yet, assume the model 
                        // is streaming the transcription as plain text (which often happens).
                        // We filter out expected protocol text or partial JSON to be clean.
                        const cleanText = fullText
                            .replace(/```json/g, "")
                            .replace(/```/g, "")
                            .replace(/"memory"\s*:/g, "")
                            .replace(/[{}"]/g, " ") // simplistic cleaning of JSON structural chars
                            .trim();

                        if (cleanText.length > 0) {
                            // Only update if it looks like actual content, not just protocol noise
                            // This ensures we capture the "raw" transcription if the model refuses to JSONify
                            console.log("Extracted raw memory:", cleanText)
                            transcribedMemoryRef.current = cleanText
                            setTranscribedMemory(cleanText)
                        }
                    }
                }
            })

            clientRef.current.on("audio", (base64Audio) => {
                streamerRef.current?.addPCM16(base64Audio)
            })

            clientRef.current.on("interrupted", () => {
                streamerRef.current?.stop()
            })

            clientRef.current.on("error", (error) => {
                console.error("Live API error:", error)
            })

            // Connect to Gemini Live API
            await clientRef.current.connect({
                model: "gemini-2.0-flash-exp",
                systemInstruction: buildSystemPrompt(false),
                responseModalities: [Modality.AUDIO, Modality.TEXT]
            })

            // Trigger initial greeting
            setTimeout(() => {
                clientRef.current?.send("Say 'Let's capture a meaningful object.'")
            }, 500)

            // Set stability timeout warning
            scanningTimeoutRef.current = setTimeout(() => {
                if (!capturedObjectRef.current && !processingCaptureRef.current) {
                    clientRef.current?.send("Say 'Keep the camera steady and object in view.'")
                }
            }, 5000)

            // Start audio recording
            recorderRef.current.on("data", (base64Audio) => {
                // Only send audio during recording phase (after object is captured)
                if (capturedObjectRef.current) {
                    clientRef.current?.sendRealtimeInput([
                        { mimeType: "audio/pcm;rate=16000", data: base64Audio }
                    ])
                }
            })
            await recorderRef.current.start()

            // Start frame analysis loop
            frameIntervalRef.current = setInterval(() => {
                if (!videoRef.current || videoRef.current.readyState < 2) return

                const stable = isFrameStable()

                if (stable) {
                    stableFrameCountRef.current++
                    setStabilityProgress(Math.min(stableFrameCountRef.current / STABLE_FRAMES_REQUIRED, 1))
                    if (DEBUG_STABILITY) {
                        console.log(`Stable frame count: ${stableFrameCountRef.current}/${STABLE_FRAMES_REQUIRED}`)
                    }
                } else {
                    stableFrameCountRef.current = 0
                    setStabilityProgress(0)
                }

                // If we haven't captured an object yet and not already processing
                if (!capturedObjectRef.current && !processingCaptureRef.current) {
                    // Send frame to Gemini for analysis
                    if (clientRef.current?.connected) {
                        const smallFrame = captureSmallFrame()
                        if (smallFrame) {
                            clientRef.current?.sendRealtimeInput([
                                { mimeType: "image/jpeg", data: smallFrame }
                            ])
                        }
                    }

                    // Capture immediately when stability threshold reached
                    if (stableFrameCountRef.current >= STABLE_FRAMES_REQUIRED) {
                        processingCaptureRef.current = true
                        stableFrameCountRef.current = 0

                        // Clear timeout
                        if (scanningTimeoutRef.current) {
                            clearTimeout(scanningTimeoutRef.current)
                            scanningTimeoutRef.current = null
                        }

                        const fullFrame = captureVideoFrame()
                        if (fullFrame) {
                            if (DEBUG_STABILITY) console.log("Capturing stable frame...")

                            generateDescription(fullFrame).then(async (description) => {
                                if (description) {
                                    capturedObjectRef.current = {
                                        imageBase64: fullFrame,
                                        description: description
                                    }

                                    // Stop video stream
                                    if (streamRef.current) {
                                        streamRef.current.getTracks().forEach(track => track.stop())
                                        streamRef.current = null
                                    }
                                    setCapturedImagePreview(fullFrame)

                                    // Play capture tone
                                    playCaptureTone()

                                    // Switch to recording state
                                    setState("recording")

                                    // Reconnect with transcription prompt
                                    if (clientRef.current) {
                                        clientRef.current.disconnect()
                                        await clientRef.current.connect({
                                            model: "gemini-2.0-flash-exp",
                                            systemInstruction: buildSystemPrompt(true),
                                            responseModalities: [Modality.AUDIO, Modality.TEXT]
                                        })

                                        // Trigger recognition greeting
                                        setTimeout(() => {
                                            const shortDesc = description.split('.')[0].substring(0, 50); // Simplify for speech
                                            clientRef.current?.send(`I captured a ${shortDesc}. Say "That's a ${shortDesc}, what does this remind you of?"`)
                                        }, 500)
                                    }
                                }
                                processingCaptureRef.current = false
                            }).catch(() => {
                                processingCaptureRef.current = false
                            })
                        } else {
                            processingCaptureRef.current = false
                        }
                    }
                }
            }, 400)  // Slightly faster interval

        } catch (error) {
            console.error("Failed to start live capture:", error)
            setState("idle")
            alert("Failed to access camera. Please check permissions.")
        }
    }, [buildSystemPrompt, captureVideoFrame, captureSmallFrame, isFrameStable, generateDescription])

    const handleDone = useCallback(async () => {
        if (!capturedObjectRef.current) {
            stopLiveCapture(true)
            return
        }

        setState("saving")

        // Stop capture resources but keep state
        stopLiveCapture(false)

        try {
            const supabase = getSupabaseClient()
            const memoryText = transcribedMemoryRef.current || "No memory recorded"
            console.log("Saving memory to database:", memoryText)

            const { error } = await supabase
                .from("object_memories")
                .insert({
                    session_id: sessionId,
                    object_image_base64: capturedObjectRef.current.imageBase64,
                    object_description: capturedObjectRef.current.description,
                    object_memory: memoryText,
                })

            if (error) {
                console.error("Error saving memory:", error)
                alert("Failed to save memory")
            }
        } catch (error) {
            console.error("Error saving memory:", error)
            alert("Failed to save memory")
        }

        // Reset to idle
        setState("idle")
        setCapturedImagePreview(null)
        setTranscribedMemory("")
        transcribedMemoryRef.current = ""
        capturedObjectRef.current = null
        setStabilityProgress(0)
    }, [stopLiveCapture, sessionId])

    const handleCancel = useCallback(() => {
        stopLiveCapture(true)
    }, [stopLiveCapture])

    useEffect(() => {
        return () => {
            stopLiveCapture(true)
        }
    }, [stopLiveCapture])

    return (
        <div className="flex flex-col items-center gap-6 sm:gap-8">
            {/* Hidden canvases for frame capture and comparison */}
            <canvas ref={canvasRef} className="hidden" />
            <canvas ref={prevCanvasRef} className="hidden" />

            {/* Video Display or Captured Image */}
            <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-black shadow-lg sm:h-[350px] sm:w-[350px]">
                {state === "idle" ? (
                    <div className="flex flex-col items-center gap-4 p-8 text-center">
                        <span className="text-6xl">🎙️</span>
                        <p className="text-lg font-medium text-white/70">
                            Live voice capture
                        </p>
                    </div>
                ) : capturedImagePreview ? (
                    <img
                        src={`data:image/png;base64,${capturedImagePreview}`}
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

                {/* Scanning indicator */}
                {state === "scanning" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
                        <div className="mx-4 w-full max-w-[90%]">
                            <div className="flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2">
                                <span className="text-xs text-white/70">Hold steady:</span>
                                <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-150 ${stabilityProgress >= 1 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${stabilityProgress * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recording indicator */}
                {state === "recording" && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1.5">
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        <span className="text-sm font-medium text-white">Recording</span>
                    </div>
                )}
            </div>

            {/* Status Message */}
            <div className="text-center min-h-[28px]">
                <p className="text-lg text-muted-foreground">
                    {state === "idle" && "Tap Start Recording to begin"}
                    {state === "scanning" && "Hold the object steady..."}
                    {state === "recording" && "Speak your memory, then tap Done"}
                </p>
            </div>

            {/* Volume Meters */}
            {(state === "scanning" || state === "recording") && (
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

            {/* Transcribed Memory Preview */}
            {transcribedMemory && state === "recording" && (
                <div className="w-full max-w-md">
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">Your Memory</label>
                        <p className="text-foreground italic">"{transcribedMemory}"</p>
                    </div>
                </div>
            )}

            {/* Single Button - changes based on state */}
            <div className="flex gap-4">
                {state === "idle" && (
                    <Button size="lg" onClick={startLiveCapture} className="min-w-44">
                        Start Recording
                    </Button>
                )}
                {state === "scanning" && (
                    <Button size="lg" variant="outline" onClick={handleCancel} className="min-w-44">
                        Cancel
                    </Button>
                )}
                {state === "recording" && (
                    <Button size="lg" onClick={handleDone} className="min-w-44">
                        Done
                    </Button>
                )}
                {state === "saving" && (
                    <Button size="lg" disabled className="min-w-44">
                        <span className="flex items-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Saving...
                        </span>
                    </Button>
                )}
            </div>

            {/* Instructions */}
            <div className="mt-2 max-w-md rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                    {state === "idle" && (
                        <>Start recording, then <strong>hold an object steady</strong> until you hear a tone. Speak your memory and tap <strong>Done</strong>.</>
                    )}
                    {state === "scanning" && (
                        <>Point at an object and <strong>hold very still</strong>. A tone will play when captured.</>
                    )}
                    {state === "recording" && (
                        <>Object captured! <strong>Speak your memory</strong> now. Tap <strong>Done</strong> when finished.</>
                    )}
                </p>
            </div>
        </div>
    )
}
