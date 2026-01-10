"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PhotoCapture } from "@/components/photo-capture"
import { LiveCapture } from "@/components/live-capture"

type CaptureMode = "photo" | "live"

export function CaptureWrapper() {
    const [mode, setMode] = useState<CaptureMode>("photo")

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
        </div>
    )
}
