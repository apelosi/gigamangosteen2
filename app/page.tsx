import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

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
              Kitchen Memory Generator
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg md:text-xl">
              Generate AI-powered images of kitchen objects with nostalgic memories.
            </p>
          </div>
        </section>

        {/* Navigation Buttons Section */}
        <section className="px-4 py-8 sm:py-12 md:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-6 sm:gap-8">
              <Link
                href="/capture"
                className="flex h-32 items-center justify-center rounded-2xl border-2 border-border bg-card text-3xl font-bold text-foreground shadow-lg transition-all hover:scale-[1.02] hover:border-primary hover:shadow-xl sm:h-40 sm:text-4xl"
              >
                Capture
              </Link>
              <Link
                href="/memories"
                className="flex h-32 items-center justify-center rounded-2xl border-2 border-border bg-card text-3xl font-bold text-foreground shadow-lg transition-all hover:scale-[1.02] hover:border-primary hover:shadow-xl sm:h-40 sm:text-4xl"
              >
                Memories
              </Link>
              <Link
                href="/remember"
                className="flex h-32 items-center justify-center rounded-2xl border-2 border-border bg-card text-3xl font-bold text-foreground shadow-lg transition-all hover:scale-[1.02] hover:border-primary hover:shadow-xl sm:h-40 sm:text-4xl"
              >
                Remember
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
