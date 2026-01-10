/**
 * AudioRecorder - Captures microphone audio and emits base64-encoded PCM data
 */

type AudioRecorderEvents = {
    data: (base64Audio: string) => void
    volume: (volume: number) => void
}

export class AudioRecorder {
    private audioContext: AudioContext | null = null
    private mediaStream: MediaStream | null = null
    private sourceNode: MediaStreamAudioSourceNode | null = null
    private processorNode: ScriptProcessorNode | null = null
    private listeners: Map<keyof AudioRecorderEvents, Set<Function>> = new Map()
    private isRecording = false
    private sampleRate: number

    constructor(sampleRate = 16000) {
        this.sampleRate = sampleRate
    }

    on<K extends keyof AudioRecorderEvents>(event: K, callback: AudioRecorderEvents[K]) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set())
        }
        this.listeners.get(event)!.add(callback)
    }

    off<K extends keyof AudioRecorderEvents>(event: K, callback: AudioRecorderEvents[K]) {
        this.listeners.get(event)?.delete(callback)
    }

    private emit<K extends keyof AudioRecorderEvents>(event: K, ...args: Parameters<AudioRecorderEvents[K]>) {
        this.listeners.get(event)?.forEach(callback => (callback as Function)(...args))
    }

    async start(): Promise<void> {
        if (this.isRecording) return

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            })

            this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)

            // Use ScriptProcessorNode for audio processing (deprecated but widely supported)
            const bufferSize = 4096
            this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

            this.processorNode.onaudioprocess = (event) => {
                if (!this.isRecording) return

                const inputData = event.inputBuffer.getChannelData(0)

                // Calculate volume for VU meter
                let sum = 0
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i]
                }
                const rms = Math.sqrt(sum / inputData.length)
                this.emit("volume", Math.min(1, rms * 10))

                // Convert Float32 to Int16
                const int16Data = new Int16Array(inputData.length)
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]))
                    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
                }

                // Convert to base64
                const base64 = this.arrayBufferToBase64(int16Data.buffer)
                this.emit("data", base64)
            }

            this.sourceNode.connect(this.processorNode)
            this.processorNode.connect(this.audioContext.destination)

            this.isRecording = true
        } catch (error) {
            console.error("Error starting audio recorder:", error)
            throw error
        }
    }

    stop(): void {
        this.isRecording = false

        if (this.processorNode) {
            this.processorNode.disconnect()
            this.processorNode = null
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect()
            this.sourceNode = null
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop())
            this.mediaStream = null
        }

        if (this.audioContext) {
            this.audioContext.close()
            this.audioContext = null
        }
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer)
        let binary = ""
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
    }
}
