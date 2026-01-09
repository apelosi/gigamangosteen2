"use client"

import { cn } from "@/lib/utils"

interface PlayingCardProps {
  suit: string
  rank: string
  isFlipped: boolean
  className?: string
}

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
}

const suitColors: Record<string, string> = {
  hearts: "text-red-600",
  diamonds: "text-red-600",
  clubs: "text-slate-900",
  spades: "text-slate-900",
}

export function PlayingCard({ suit, rank, isFlipped, className }: PlayingCardProps) {
  const symbol = suitSymbols[suit]
  const color = suitColors[suit]

  return (
    <div
      className={cn("relative h-48 w-32 sm:h-64 sm:w-44 md:h-80 md:w-56 perspective-1000", className)}
      style={{ perspective: "1000px" }}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500",
          isFlipped && "[transform:rotateY(180deg)]",
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Card Back */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          <img
            src="/card-back.png"
            alt="Card Back"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Card Front */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-between rounded-xl bg-white p-3 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] sm:p-4"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* Top left */}
          <div className="flex w-full flex-col items-start">
            <span className={cn("text-xl font-bold sm:text-2xl", color)}>{rank}</span>
            <span className={cn("text-2xl sm:text-3xl", color)}>{symbol}</span>
          </div>

          {/* Center */}
          <span className={cn("text-5xl sm:text-7xl md:text-8xl", color)}>{symbol}</span>

          {/* Bottom right (inverted) */}
          <div className="flex w-full rotate-180 flex-col items-start">
            <span className={cn("text-xl font-bold sm:text-2xl", color)}>{rank}</span>
            <span className={cn("text-2xl sm:text-3xl", color)}>{symbol}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
