import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CardGame } from "@/components/card-game"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Main content with padding for fixed header */}
      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-muted/50 to-background px-4 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              Card Guessing Game
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg md:text-xl">
              Test your psychic abilities! Guess the card before it's revealed.
            </p>
          </div>
        </section>

        {/* Game Section */}
        <section className="px-4 py-8 sm:py-12 md:py-16">
          <div className="mx-auto max-w-4xl">
            <CardGame />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
