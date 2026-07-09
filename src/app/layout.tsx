import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { Providers } from "@/components/Providers"
import { getSessionUserTheme } from "@/lib/user-theme"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

export const metadata: Metadata = {
  title: "Churn Household OS",
  description: "The operating system for the Churn household.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Churn HOS",
  },
}

// Browser-chrome tint per theme — dark themes get their page background so the
// status bar area doesn't glow indigo above a near-black app.
const THEME_COLOR: Record<string, string> = {
  dark: "#050505",
  midnight: "#0d1629",
  aurora: "#0b0b1f",
}

export async function generateViewport(): Promise<Viewport> {
  const user = await getSessionUserTheme().catch(() => null)
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: THEME_COLOR[user?.theme ?? ""] ?? "#6366f1",
    viewportFit: "cover",   // required for env(safe-area-inset-*) to return real values
    // Resize the layout viewport when the on-screen keyboard opens so
    // bottom-sheet modals stay above it instead of being covered.
    interactiveWidget: "resizes-content",
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserTheme().catch(() => null)
  const theme = user?.theme ?? "default"

  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      {/* data-theme lives on <body> (not an inner div) so themed backgrounds
          cover the overscroll/rubber-band area instead of flashing light grey */}
      <body
        data-theme={theme !== "default" ? theme : undefined}
        className="h-full font-sans antialiased text-slate-900"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
