/**
 * AudioStreamer - Plays back PCM16 audio data received from the API
 */

type AudioStreamerEvents = {
    complete: () => void
    volume: (volume: number) => void
}

export class AudioStreamer {
    private audioContext: AudioContext
    private gainNode: GainNode
    private queue: AudioBuffer[] = []
    private isPlaying = false
    private nextTime = 0
    private listeners: Map<keyof AudioStreamerEvents, Set<Function>> = new Map()
    private sampleRate: number

    constructor(sampleRate = 24000) {
        this.sampleRate = sampleRate
        this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
        this.gainNode = this.audioContext.createGain()
        this.gainNode.connect(this.audioContext.destination)
    }

    on<K extends keyof AudioStreamerEvents>(event: K, callback: AudioStreamerEvents[K]) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set())
        }
        this.listeners.get(event)!.add(callback)
    }

    off<K extends keyof AudioStreamerEvents>(event: K, callback: AudioStreamerEvents[K]) {
        this.listeners.get(event)?.delete(callback)
    }

    private emit<K extends keyof AudioStreamerEvents>(event: K, ...args: Parameters<AudioStreamerEvents[K]>) {
        this.listeners.get(event)?.forEach(callback => (callback as Function)(...args))
    }

    /**
     * Add PCM16 audio data to the playback queue
     */
    addPCM16(base64Data: string): void {
        // Decode base64 to ArrayBuffer
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }

        // Convert Int16 to Float32
        const int16Data = new Int16Array(bytes.buffer)
        const float32Data = new Float32Array(int16Data.length)
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768
        }

        // Calculate volume for feedback
        let sum = 0
        for (let i = 0; i < float32Data.length; i++) {
            sum += float32Data[i] * float32Data[i]
        }
        const rms = Math.sqrt(sum / float32Data.length)
        this.emit("volume", Math.min(1, rms * 5))

        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.sampleRate)
        audioBuffer.copyToChannel(float32Data, 0)
        this.queue.push(audioBuffer)

        // Start playback if not already playing
        if (!this.isPlaying) {
            this.scheduleNextBuffer()
        }
    }

    private scheduleNextBuffer(): void {
        if (this.queue.length === 0) {
            this.isPlaying = false
            this.emit("complete")
            return
        }

        this.isPlaying = true
        const buffer = this.queue.shift()!

        // Resume audio context if suspended
        if (this.audioContext.state === "suspended") {
            this.audioContext.resume()
        }

        const source = this.audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(this.gainNode)

        // Schedule playback
        const startTime = Math.max(this.audioContext.currentTime, this.nextTime)
        source.start(startTime)

        this.nextTime = startTime + buffer.duration

        // Schedule next buffer
        source.onended = () => {
            this.scheduleNextBuffer()
        }
    }

    /**
     * Stop playback and clear queue
     */
    stop(): void {
        this.queue = []
        this.isPlaying = false
        this.nextTime = 0

        // Ramp down gain to avoid clicks
        const now = this.audioContext.currentTime
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now)
        this.gainNode.gain.linearRampToValueAtTime(0, now + 0.1)

        // Reset gain after ramp
        setTimeout(() => {
            this.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime)
        }, 150)
    }

    /**
     * Resume audio context (must be called from user gesture)
     */
    async resume(): Promise<void> {
        if (this.audioContext.state === "suspended") {
            await this.audioContext.resume()
        }
    }

    /**
     * Close and cleanup
     */
    close(): void {
        this.stop()
        this.audioContext.close()
    }
}
