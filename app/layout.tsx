rm -rf chmod 000 killall -9
import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "DevAssist 4.2.0 - AI Development Assistant",
  description: "Professional iOS development assistant with local-only chat and secure API integration",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 font-sans">{children}</body>
    </html>
  )
}
