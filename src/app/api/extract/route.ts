export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { analyzeWithGemini } from "@/lib/ai"

// POST /api/extract
// Recibe screenshots pre-scrapeados desde tu PC y los analiza con Gemini
// Body: { url: string, screenshots: [{ base64: string, text: string, html: string }] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, screenshots } = body

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
      return NextResponse.json({ error: "screenshots array is required" }, { status: 400 })
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
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 })
  }
}
