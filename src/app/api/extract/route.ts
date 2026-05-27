export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextRequest, NextResponse } from "next/server"
import { extractQuizFunnel } from "@/lib/extractor"
import { analyzeWithGemini } from "@/lib/gemini"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

    const extraction = await extractQuizFunnel(url)
    if (extraction.slides.length === 0) {
      return NextResponse.json({ error: "No slides could be extracted from this URL" }, { status: 422 })
    }

    const analysis = await analyzeWithGemini(extraction.slides)

    const slides = analysis.slides.map((slide, i) => ({
      ...slide,
      screenshot_base64: extraction.slides[i]?.screenshot_base64 || null,
    }))

    return NextResponse.json({
      slides,
      funnel_style_notes: analysis.funnel_style_notes,
      total_questions: analysis.total_questions,
      ad_copy_insights: analysis.ad_copy_insights,
      landing_url: extraction.landing_url,
      slides_extracted: extraction.slides.length,
    })
  } catch (error: any) {
    console.error("Extraction error:", error)
    return NextResponse.json({ error: error.message || "Extraction failed" }, { status: 500 })
  }
}
