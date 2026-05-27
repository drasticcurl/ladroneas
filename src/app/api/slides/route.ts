export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { uploadScreenshot } from "@/lib/storage"

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(request.url)
  const funnelId = searchParams.get("funnel_id")
  if (!funnelId) return NextResponse.json({ error: "funnel_id required" }, { status: 400 })
  const { data, error } = await supabase.from("extractor_123_slides").select("*").eq("funnel_id", funnelId).order("slide_order", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const body = await request.json()

  // Si viene un screenshot_base64, subirlo a Storage y guardar la URL
  let screenshotUrl = body.screenshot_url || null
  if (body.screenshot_base64 && body.funnel_id) {
    const url = await uploadScreenshot(body.funnel_id, body.slide_order || 1, body.screenshot_base64)
    if (url) screenshotUrl = url
  }

  // Quitar screenshot_base64 del body (no va a la DB) y poner la URL
  const { screenshot_base64, ...dbBody } = body
  dbBody.screenshot_url = screenshotUrl

  const { data, error } = await supabase.from("extractor_123_slides").insert(dbBody).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
