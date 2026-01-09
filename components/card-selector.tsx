"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CardSelectorProps {
  selectedRank: string
  selectedSuit: string
  onRankChange: (rank: string) => void
  onSuitChange: (suit: string) => void
  disabled?: boolean
}

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
const suits = ["hearts", "diamonds", "clubs", "spades"]

const suitLabels: Record<string, string> = {
  hearts: "♥ Hearts",
  diamonds: "♦ Diamonds",
  clubs: "♣ Clubs",
  spades: "♠ Spades",
}

export function CardSelector({ selectedRank, selectedSuit, onRankChange, onSuitChange, disabled }: CardSelectorProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="rank-select" className="text-sm font-medium text-muted-foreground">
          Select Rank
        </label>
        <Select value={selectedRank} onValueChange={onRankChange} disabled={disabled}>
          <SelectTrigger id="rank-select" className="w-full sm:w-32" aria-label="Select card rank">
            <SelectValue placeholder="Rank" />
          </SelectTrigger>
          <SelectContent>
            {ranks.map((rank) => (
              <SelectItem key={rank} value={rank}>
                {rank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="suit-select" className="text-sm font-medium text-muted-foreground">
          Select Suit
        </label>
        <Select value={selectedSuit} onValueChange={onSuitChange} disabled={disabled}>
          <SelectTrigger id="suit-select" className="w-full sm:w-40" aria-label="Select card suit">
            <SelectValue placeholder="Suit" />
          </SelectTrigger>
          <SelectContent>
            {suits.map((suit) => (
              <SelectItem key={suit} value={suit}>
                {suitLabels[suit]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
