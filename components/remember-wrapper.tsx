"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RememberCapture } from "@/components/remember-capture"
import { LiveRecall } from "@/components/live-recall"

type RecallMode = "photo" | "live"

export function RememberWrapper() {
    const [mode, setMode] = useState<RecallMode>("photo")

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
                    <p>Upload or take a photo to search for its memory</p>
                ) : (
                    <p>Use live video and voice to recall memories in real-time</p>
                )}
            </div>

            {/* Content */}
            {mode === "photo" ? <RememberCapture /> : <LiveRecall />}
        </div>
    )
}
