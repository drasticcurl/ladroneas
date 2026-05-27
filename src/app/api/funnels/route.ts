export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") || ""
  let query = supabase.from("extractor_123").select("*").order("created_at", { ascending: false })
  if (search) query = query.or(`ad_copy.ilike.%${search}%,notes.ilike.%${search}%,cta.ilike.%${search}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const body = await request.json()
  const { data, error } = await supabase.from("extractor_123").insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
