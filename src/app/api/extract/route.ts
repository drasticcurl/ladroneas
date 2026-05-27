export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { analyzeWithGemini } from "@/lib/ai"
import { scrapeQuizFunnel } from "@/lib/scraper"

// POST /api/extract
// Modo 1 (web UI): { url: string } → scrapea + analiza
// Modo 2 (CLI): { url: string, screenshots: [...] } → solo analiza
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, screenshots: preScraped } = body

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

    let screenshots: { base64: string; text: string; html: string }[]

    if (preScraped && Array.isArray(preScraped) && preScraped.length > 0) {
      console.log("[extract] Modo CLI: recibidos " + preScraped.length + " screenshots")
      screenshots = preScraped
    } else {
      console.log("[extract] Modo Web UI: scrapeando " + url)
      screenshots = await scrapeQuizFunnel(url)
      if (screenshots.length === 0) {
        return NextResponse.json({ error: "No se pudieron extraer slides de esta URL" }, { status: 422 })
      }
    }

    console.log("[extract] 🤖 Enviando " + screenshots.length + " slides a Gemini...")
    const analysis = await analyzeWithGemini(screenshots)
    console.log("[extract] ✅ Analisis completo: " + analysis.slides.length + " slides analizados")

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
    console.error("[extract] ❌ Error:", error.message)
    return NextResponse.json({ error: error.message || "Extraction failed" }, { status: 500 })
  }
}
