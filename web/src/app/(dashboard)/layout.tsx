import Navigation from "@/components/Navigation"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="page-container">
      <Navigation />
      <div className="page-content">{children}</div>
    </div>
  )
}
