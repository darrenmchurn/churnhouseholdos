import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { Providers } from "@/components/Providers"
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6366f1",
  viewportFit: "cover",   // required for env(safe-area-inset-*) to return real values
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full bg-[#f4f4f6] font-sans antialiased text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
