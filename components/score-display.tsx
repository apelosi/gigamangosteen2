import { cn } from "@/lib/utils"

interface ScoreDisplayProps {
  correct: number
  incorrect: number
  className?: string
}

export function ScoreDisplay({ correct, incorrect, className }: ScoreDisplayProps) {
  const total = correct + incorrect
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-card p-4 shadow-md sm:flex-row sm:items-center sm:gap-8 sm:p-6",
        className,
      )}
      role="region"
      aria-label="Score display"
    >
      <div className="flex items-center gap-6 sm:gap-8">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-success sm:text-4xl">{correct}</span>
          <span className="text-sm text-muted-foreground">Correct</span>
        </div>
        <div className="h-12 w-px bg-border" aria-hidden="true" />
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-destructive sm:text-4xl">{incorrect}</span>
          <span className="text-sm text-muted-foreground">Incorrect</span>
        </div>
      </div>
      {total > 0 && (
        <div className="flex flex-col items-center sm:ml-auto">
          <span className="text-2xl font-semibold text-primary sm:text-3xl">{percentage}%</span>
          <span className="text-sm text-muted-foreground">Accuracy</span>
        </div>
      )}
    </div>
  )
}
