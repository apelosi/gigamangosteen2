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

interface SessionData {
  session_id: string
  wins: number
  losses: number
  created_at: string
  updated_at: string
}

function getRandomCard() {
  return {
    rank: ranks[Math.floor(Math.random() * ranks.length)],
    suit: suits[Math.floor(Math.random() * suits.length)],
  }
}

export function CardGame() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
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

    console.log("Creating session:", newSessionId)
    const { error } = await supabase.from("card_guessing").insert({ session_id: newSessionId, wins: 0, losses: 0 })

    if (error) {
      console.error("Error creating session:", error)
    } else {
      console.log("Session created successfully")
      setSessionId(newSessionId)
    }
  }, [])

  const fetchSessionData = useCallback(async () => {
    if (!sessionId) {
      console.log("No sessionId, skipping fetch")
      return
    }

    console.log("Fetching session data for:", sessionId)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("card_guessing")
      .select("session_id, wins, losses, created_at, updated_at")
      .eq("session_id", sessionId)
      .single()

    if (error) {
      console.error("Error fetching session data:", error)
    } else if (data) {
      console.log("Session data fetched:", data)
      setSessionData(data)
    }
  }, [sessionId])

  const updateSession = useCallback(
    async (wins: number, losses: number) => {
      if (!sessionId) return

      const supabase = getSupabaseClient()

      await supabase
        .from("card_guessing")
        .update({ wins, losses, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId)

      // Fetch updated data after update
      fetchSessionData()
    },
    [sessionId, fetchSessionData],
  )

  useEffect(() => {
    createSession()
  }, [createSession])

  useEffect(() => {
    if (sessionId) {
      fetchSessionData()
    }
  }, [sessionId, fetchSessionData])

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

      {/* Database Debug Section */}
      <div className="mt-12 w-full max-w-4xl">
        <h2 className="mb-2 text-xl font-semibold uppercase tracking-wide text-muted-foreground">
          DATABASE RECORD (DEVELOPMENT)
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">Verify that data is being saved to the database</p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/50 p-8 shadow-sm backdrop-blur-sm">
          {sessionData ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">session_id</th>
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">wins</th>
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">losses</th>
                    <th className="pb-4 pr-8 text-left text-base font-normal text-muted-foreground">created_at</th>
                    <th className="pb-4 text-left text-base font-normal text-muted-foreground">updated_at</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-6 pr-8 font-mono text-sm text-foreground">{sessionData.session_id}</td>
                    <td className="py-6 pr-8 text-base text-foreground">{sessionData.wins}</td>
                    <td className="py-6 pr-8 text-base text-foreground">{sessionData.losses}</td>
                    <td className="py-6 pr-8 text-base text-foreground">
                      {new Date(sessionData.created_at).toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })}
                    </td>
                    <td className="py-6 text-base text-foreground">
                      {new Date(sessionData.updated_at).toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">Loading session data... (Check console for errors)</p>
          )}
        </div>
      </div>
    </div>
  )
}
