import { getSupabaseAdmin } from "./supabase"

const BUCKET = "screenshots"

/**
 * Sube un screenshot (base64 PNG) a Supabase Storage y devuelve la URL pública.
 * Path: screenshots/{funnelId}/slide_{order}.png
 */
export async function uploadScreenshot(
  funnelId: string,
  slideOrder: number,
  base64: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin()
    const buffer = new Uint8Array([...atob(base64)].map(c => c.charCodeAt(0)))
    const path = `${funnelId}/slide_${String(slideOrder).padStart(2, "0")}.png`

    // Subir al bucket
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      })

    if (uploadError) {
      console.error(`[storage] Error subiendo slide ${slideOrder}:`, uploadError.message)
      return null
    }

    // Obtener URL pública
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    console.log(`[storage] 📸 Slide ${slideOrder} subido: ${path}`)
    return data.publicUrl
  } catch (error: any) {
    console.error(`[storage] Error en uploadScreenshot:`, error.message)
    return null
  }
}

/**
 * Sube todos los screenshots de un funnel y devuelve array de URLs.
 */
export async function uploadAllScreenshots(
  funnelId: string,
  screenshots: { base64: string; order: number }[]
): Promise<(string | null)[]> {
  console.log(`[storage] 📤 Subiendo ${screenshots.length} screenshots para funnel ${funnelId}...`)
  const results = await Promise.all(
    screenshots.map(s => uploadScreenshot(funnelId, s.order, s.base64))
  )
  const uploaded = results.filter(Boolean).length
  console.log(`[storage] ✅ ${uploaded}/${screenshots.length} screenshots subidos`)
  return results
}
