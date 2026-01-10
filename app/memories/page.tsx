import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MemoriesTable } from "@/components/memories-table"

export default function MemoriesPage() {
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
              Memories
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Browse all your saved memories. Click on any row to view details.
            </p>
          </div>
        </section>

        {/* Memories Table Section */}
        <section className="px-4 py-8 sm:py-12 md:py-16">
          <div className="mx-auto max-w-6xl">
            <MemoriesTable />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
