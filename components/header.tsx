"use client"

import { useEffect, useState } from "react"
import { Logo } from "./logo"

export function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "header-blur shadow-lg" : "bg-[var(--color-header-bg)]"
      }`}
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 sm:h-10 sm:w-10" />
            <span className="text-lg font-semibold text-[var(--color-header-foreground)] sm:text-xl">
              Giga Mangosteen
            </span>
          </div>
          <nav aria-label="Main navigation">
            <span className="text-sm text-[var(--color-header-foreground)]/70">Everbloom</span>
          </nav>
        </div>
      </div>
    </header>
  )
}
