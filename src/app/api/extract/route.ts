export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextRequest, NextResponse } from "next/server"
import { analyzeWithGemini } from "@/lib/ai"
import { scrapeQuizFunnel } from "@/lib/scraper"

// POST /api/extract
// Modo 1 (desde web UI): { url: string } → scrapea + analiza
// Modo 2 (desde CLI): { url: string, screenshots: [...] } → solo analiza
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, screenshots: preScraped } = body

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

    let screenshots: { base64: string; text: string; html: string }[]

    if (preScraped && Array.isArray(preScraped) && preScraped.length > 0) {
      // Modo CLI: ya vienen los screenshots
      screenshots = preScraped
    } else {
      // Modo Web UI: scrapear server-side
      screenshots = await scrapeQuizFunnel(url)
      if (screenshots.length === 0) {
        return NextResponse.json({ error: "No se pudieron extraer slides de esta URL" }, { status: 422 })
      }
    }

    // Analyze with Gemini
    const analysis = await analyzeWithGemini(screenshots)

    // Attach screenshots to slides
    const slides = analysis.slides.map((slide, i) => ({
      ...slide,
      screenshot_base64: screenshots[i]?.base64 || null,
    }))

    return NextResponse.json({
      slides,
      funnel_style_notes: analysis.funnel_style_notes,
      total_questions: analysis.total_questions,
      ad_copy_insights: analysis.ad_copy_insights,
      landing_url: url,
      slides_extracted: screenshots.length,
    })
  } catch (error: any) {
    console.error("Extract API error:", error)
    return NextResponse.json({ error: error.message || "Extraction failed" }, { status: 500 })
  }
}
