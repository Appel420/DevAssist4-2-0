rm -rf chmod 000 killall -9
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DevAssist 4.2.0 - AI Development Assistant",
  description: "Professional iOS development assistant with AI-powered chat and secure API integration",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-900`}>{children}</body>
    </html>
  )
}
