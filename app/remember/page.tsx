import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function RememberPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Main content with padding for fixed header */}
      <main className="flex-1 pt-16">
        {/* Back Button */}
        <div className="px-4 pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-xl">&larr;</span>
            <span>Back</span>
          </Link>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-muted/50 to-background px-4 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              Remember
            </h1>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
