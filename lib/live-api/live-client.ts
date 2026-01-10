/**
 * LiveClient - Manages WebSocket connection to Google Gemini Live API
 */

import { GoogleGenAI, LiveConnectConfig, Modality } from "@google/genai"

export type LiveClientEvents = {
    open: () => void
    close: () => void
    error: (error: Error) => void
    audio: (base64Audio: string) => void
    content: (text: string) => void
    interrupted: () => void
    turncomplete: () => void
    setupcomplete: () => void
}

export interface LiveClientConfig {
    model?: string
    systemInstruction?: string
    tools?: Array<{
        name: string
        description: string
        parameters?: Record<string, unknown>
    }>
}

export class LiveClient {
    private genAI: GoogleGenAI
    private session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null
    private listeners: Map<keyof LiveClientEvents, Set<Function>> = new Map()
    private isConnected = false

    constructor(apiKey: string) {
        this.genAI = new GoogleGenAI({ apiKey })
    }

    on<K extends keyof LiveClientEvents>(event: K, callback: LiveClientEvents[K]) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set())
        }
        this.listeners.get(event)!.add(callback)
        return () => this.off(event, callback)
    }

    off<K extends keyof LiveClientEvents>(event: K, callback: LiveClientEvents[K]) {
        this.listeners.get(event)?.delete(callback)
    }

    private emit<K extends keyof LiveClientEvents>(event: K, ...args: Parameters<LiveClientEvents[K]>) {
        this.listeners.get(event)?.forEach(callback => (callback as Function)(...args))
    }

    async connect(config: LiveClientConfig = {}): Promise<void> {
        const model = config.model || "gemini-2.0-flash-exp"

        const connectConfig: LiveConnectConfig = {
            responseModalities: [Modality.AUDIO],
        }

        if (config.systemInstruction) {
            connectConfig.systemInstruction = {
                parts: [{ text: config.systemInstruction }]
            }
        }

        try {
            this.session = await this.genAI.live.connect({
                model,
                config: connectConfig,
                callbacks: {
                    onopen: () => {
                        this.isConnected = true
                        this.emit("open")
                        this.emit("setupcomplete")
                    },
                    onmessage: (message) => {
                        this.handleMessage(message)
                    },
                    onerror: (error) => {
                        console.error("LiveClient error:", error)
                        this.emit("error", error instanceof Error ? error : new Error(String(error)))
                    },
                    onclose: () => {
                        this.isConnected = false
                        this.emit("close")
                    }
                }
            })
        } catch (error) {
            console.error("Failed to connect:", error)
            throw error
        }
    }

    private handleMessage(message: unknown) {
        // The message structure from Gemini Live API
        const msg = message as {
            serverContent?: {
                modelTurn?: {
                    parts?: Array<{
                        text?: string
                        inlineData?: {
                            mimeType: string
                            data: string
                        }
                    }>
                }
                turnComplete?: boolean
                interrupted?: boolean
            }
            setupComplete?: boolean
        }

        if (msg.setupComplete) {
            this.emit("setupcomplete")
            return
        }

        if (msg.serverContent) {
            if (msg.serverContent.interrupted) {
                this.emit("interrupted")
                return
            }

            if (msg.serverContent.modelTurn?.parts) {
                for (const part of msg.serverContent.modelTurn.parts) {
                    if (part.inlineData?.mimeType?.startsWith("audio/")) {
                        this.emit("audio", part.inlineData.data)
                    }
                    if (part.text) {
                        this.emit("content", part.text)
                    }
                }
            }

            if (msg.serverContent.turnComplete) {
                this.emit("turncomplete")
            }
        }
    }

    /**
     * Send realtime input (audio and/or video frames)
     */
    sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>): void {
        if (!this.session || !this.isConnected) return

        this.session.sendRealtimeInput({
            media: chunks.map(chunk => ({
                mimeType: chunk.mimeType,
                data: chunk.data
            }))
        })
    }

    /**
     * Send a text message
     */
    send(text: string): void {
        if (!this.session || !this.isConnected) return

        this.session.sendClientContent({
            turns: [{
                role: "user",
                parts: [{ text }]
            }],
            turnComplete: true
        })
    }

    /**
     * Disconnect from the session
     */
    disconnect(): void {
        if (this.session) {
            this.session.close()
            this.session = null
        }
        this.isConnected = false
    }

    /**
     * Check if connected
     */
    get connected(): boolean {
        return this.isConnected
    }
}
