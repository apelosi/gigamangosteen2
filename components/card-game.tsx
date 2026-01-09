"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PlayingCard } from "./playing-card"
import { CardSelector } from "./card-selector"
import { ScoreDisplay } from "./score-display"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
const suits = ["hearts", "diamonds", "clubs", "spades"]

interface GameState {
  currentCard: { rank: string; suit: string }
  isFlipped: boolean
  hasGuessed: boolean
  lastResult: "correct" | "incorrect" | null
  correct: number
  incorrect: number
}

function getRandomCard() {
  return {
    rank: ranks[Math.floor(Math.random() * ranks.length)],
    suit: suits[Math.floor(Math.random() * suits.length)],
  }
}

export function CardGame() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState>({
    currentCard: getRandomCard(),
    isFlipped: false,
    hasGuessed: false,
    lastResult: null,
    correct: 0,
    incorrect: 0,
  })

  const [selectedRank, setSelectedRank] = useState<string>("")
  const [selectedSuit, setSelectedSuit] = useState<string>("")

  const createSession = useCallback(async () => {
    const supabase = getSupabaseClient()
    const newSessionId = crypto.randomUUID()

    const { error } = await supabase.from("card_guessing").insert({ session_id: newSessionId, wins: 0, losses: 0 })

    if (!error) {
      setSessionId(newSessionId)
    }
  }, [])

  const updateSession = useCallback(
    async (wins: number, losses: number) => {
      if (!sessionId) return

      const supabase = getSupabaseClient()

      await supabase
        .from("card_guessing")
        .update({ wins, losses, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId)
    },
    [sessionId],
  )

  useEffect(() => {
    createSession()
  }, [createSession])

  const handleGuess = useCallback(() => {
    if (!selectedRank || !selectedSuit) return

    const isCorrect = selectedRank === gameState.currentCard.rank && selectedSuit === gameState.currentCard.suit

    const newCorrect = isCorrect ? gameState.correct + 1 : gameState.correct
    const newIncorrect = isCorrect ? gameState.incorrect : gameState.incorrect + 1

    setGameState((prev) => ({
      ...prev,
      isFlipped: true,
      hasGuessed: true,
      lastResult: isCorrect ? "correct" : "incorrect",
      correct: newCorrect,
      incorrect: newIncorrect,
    }))

    updateSession(newCorrect, newIncorrect)
  }, [selectedRank, selectedSuit, gameState.currentCard, gameState.correct, gameState.incorrect, updateSession])

  const handleNextCard = useCallback(() => {
    setSelectedRank("")
    setSelectedSuit("")
    setGameState((prev) => ({
      ...prev,
      currentCard: getRandomCard(),
      isFlipped: false,
      hasGuessed: false,
      lastResult: null,
    }))
  }, [])

  const handleReset = useCallback(() => {
    setSelectedRank("")
    setSelectedSuit("")
    setGameState({
      currentCard: getRandomCard(),
      isFlipped: false,
      hasGuessed: false,
      lastResult: null,
      correct: 0,
      incorrect: 0,
    })
    createSession()
  }, [createSession])

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-8">
      {/* Score Display */}
      <ScoreDisplay correct={gameState.correct} incorrect={gameState.incorrect} className="w-full max-w-md" />

      {/* Card Display */}
      <div className="relative">
        <PlayingCard
          suit={gameState.currentCard.suit}
          rank={gameState.currentCard.rank}
          isFlipped={gameState.isFlipped}
        />
      </div>

      {/* Game Controls */}
      <div className="mt-4 flex flex-col items-center gap-6">
        {gameState.hasGuessed && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-6 py-3 text-lg font-bold shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-300",
              gameState.lastResult === "correct"
                ? "bg-success text-success-foreground"
                : "bg-destructive text-destructive-foreground",
            )}
            role="alert"
            aria-live="polite"
          >
            {gameState.lastResult === "correct" ? (
              <>
                <span className="text-2xl">🎉</span>
                <span>CORRECT!</span>
              </>
            ) : (
              <>
                <span className="text-2xl">❌</span>
                <span>INCORRECT</span>
              </>
            )}
          </div>
        )}
        {!gameState.hasGuessed ? (
          <>
            <p className="text-center text-lg font-medium text-foreground">What card do you think this is?</p>
            <CardSelector
              selectedRank={selectedRank}
              selectedSuit={selectedSuit}
              onRankChange={setSelectedRank}
              onSuitChange={setSelectedSuit}
              disabled={gameState.hasGuessed}
            />
            <Button
              size="lg"
              onClick={handleGuess}
              disabled={!selectedRank || !selectedSuit}
              className="w-full sm:w-auto"
            >
              Reveal Card
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" onClick={handleNextCard} className="min-w-40">
              Next Card
            </Button>
            <Button size="lg" variant="outline" onClick={handleReset} className="min-w-40 bg-transparent">
              Start Over
            </Button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 max-w-md rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Select a rank and suit, then click reveal to see if your guess is correct. Cards are randomly drawn from a
          standard 52-card deck.
        </p>
      </div>
    </div>
  )
}
