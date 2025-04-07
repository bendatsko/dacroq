import { GeistSans } from "geist/font/sans"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Dacroq",
  description: "Dashboard pages for hardware testing.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-new-gr-c-s-check-loaded="14.1229.0"
      data-gr-ext-installed=""
    >
      <body
        className={`${GeistSans.className} min-h-full bg-white antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}