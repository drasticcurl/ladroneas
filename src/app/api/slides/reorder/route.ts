import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function PUT(request: NextRequest) {
  const { slides } = await request.json()
  if (!slides || !Array.isArray(slides)) return NextResponse.json({ error: "slides array required" }, { status: 400 })
  const updates = slides.map((s: { id: string; slide_order: number }) => supabaseAdmin.from("extractor_123_slides").update({ slide_order: s.slide_order }).eq("id", s.id))
  const results = await Promise.all(updates)
  if (results.some(r => r.error)) return NextResponse.json({ error: "Some failed" }, { status: 500 })
  return NextResponse.json({ success: true })
}
