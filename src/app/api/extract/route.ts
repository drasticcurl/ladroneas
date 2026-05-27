export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { analyzeWithGemini } from "@/lib/ai"
import { scrapeQuizFunnel } from "@/lib/scraper"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, screenshots: preScraped, maxSlides } = body

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

    let screenshots: { base64: string; text: string; html: string }[]

    if (preScraped && Array.isArray(preScraped) && preScraped.length > 0) {
      console.log("[extract] Modo CLI: recibidos " + preScraped.length + " screenshots")
      screenshots = preScraped
    } else {
      const slidesLimit = maxSlides && Number(maxSlides) > 0 ? Number(maxSlides) : 30
      console.log("[extract] Modo Web UI: scrapeando " + url + " (max " + slidesLimit + " slides)")
      screenshots = await scrapeQuizFunnel(url, slidesLimit)
      if (screenshots.length === 0) {
        return NextResponse.json({ error: "No se pudieron extraer slides de esta URL" }, { status: 422 })
      }
    }

    console.log("[extract] 🤖 Enviando " + screenshots.length + " slides a OpenAI...")
    const analysis = await analyzeWithGemini(screenshots)
    console.log("[extract] ✅ " + analysis.slides.length + " slides analizados")
    console.log("[extract] 💰 $" + analysis.cost.total_cost_usd.toFixed(4) + " USD (" + analysis.cost.total_tokens.toLocaleString() + " tokens)")

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
      cost: analysis.cost,
    })
  } catch (error: any) {
    console.error("[extract] ❌ Error:", error.message)
    return NextResponse.json({ error: error.message || "Extraction failed" }, { status: 500 })
  }
}
