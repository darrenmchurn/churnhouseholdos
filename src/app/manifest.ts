import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Churn Household OS",
    short_name: "Churn HOS",
    description: "The operating system for the Churn household.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f6",
    theme_color: "#6366f1",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
