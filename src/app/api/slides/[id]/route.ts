import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { data, error } = await supabaseAdmin.from("extractor_123_slides").update(body).eq("id", params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin.from("extractor_123_slides").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
