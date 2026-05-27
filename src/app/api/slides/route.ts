export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

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
  const { data, error } = await supabase.from("extractor_123_slides").insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
