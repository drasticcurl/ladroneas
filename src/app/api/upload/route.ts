import { NextRequest, NextResponse } from "next/server"
import cloudinary from "@/lib/cloudinary"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: "extractor-123", resource_type: "image" }, (err, res) => { if (err) reject(err); else resolve(res as any) }).end(buffer)
    })
    return NextResponse.json({ url: result.secure_url })
  } catch (e) { console.error(e); return NextResponse.json({ error: "Upload failed" }, { status: 500 }) }
}
