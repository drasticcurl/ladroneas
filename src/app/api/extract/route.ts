export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { scrapeQuizFunnel } from "@/lib/scraper"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, maxSlides, delayPerSlide } = body

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

    const slidesLimit = maxSlides && Number(maxSlides) > 0 ? Number(maxSlides) : 30
    const delay = delayPerSlide && Number(delayPerSlide) > 0 ? Number(delayPerSlide) : 3
    console.log("[extract] Scrapeando " + url + " (max " + slidesLimit + " slides, " + delay + "s/slide)")

    const screenshots = await scrapeQuizFunnel(url, slidesLimit, delay)
    if (screenshots.length === 0) {
      return NextResponse.json({ error: "No se pudieron extraer slides de esta URL" }, { status: 422 })
    }

    console.log("[extract] ✅ " + screenshots.length + " slides extraidos (sin análisis)")

    return NextResponse.json({
      screenshots,
      slides_extracted: screenshots.length,
      landing_url: url,
    })
  } catch (error: any) {
    console.error("[extract] ❌ Error:", error.message)
    return NextResponse.json({ error: error.message || "Extraction failed" }, { status: 500 })
  }
}
