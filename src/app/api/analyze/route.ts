export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { analyzeWithGemini } from "@/lib/ai"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { screenshots, model } = body

    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
      return NextResponse.json({ error: "screenshots array is required" }, { status: 400 })
    }

    const selectedModel = model || "gpt-4.1-mini"
    console.log("[analyze] 🤖 Enviando " + screenshots.length + " slides a " + selectedModel + "...")

    const analysis = await analyzeWithGemini(screenshots, { model: selectedModel })

    console.log("[analyze] ✅ " + analysis.slides.length + " slides analizados")
    console.log("[analyze] 💰 $" + analysis.cost.total_cost_usd.toFixed(4) + " USD (" + analysis.cost.total_tokens.toLocaleString() + " tokens)")

    const slides = analysis.slides.map((slide, i) => ({
      ...slide,
      screenshot_base64: screenshots[i]?.base64 || null,
    }))

    return NextResponse.json({
      slides,
      funnel_style_notes: analysis.funnel_style_notes,
      total_questions: analysis.total_questions,
      ad_copy_insights: analysis.ad_copy_insights,
      cost: analysis.cost,
    })
  } catch (error: any) {
    console.error("[analyze] ❌ Error:", error.message)
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 })
  }
}
