const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

/**
 * Sube un screenshot (base64 PNG) a Cloudinary y devuelve la URL.
 * Usa unsigned upload con el preset configurado.
 */
export async function uploadScreenshot(
  funnelId: string,
  slideOrder: number,
  base64: string
): Promise<string | null> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error("[storage] Missing CLOUDINARY env vars, skipping upload")
    return null
  }

  try {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: `data:image/png;base64,${base64}`,
        upload_preset: UPLOAD_PRESET,
        folder: `funnels/${funnelId}`,
        public_id: `slide_${String(slideOrder).padStart(2, "0")}`,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[storage] Cloudinary error slide ${slideOrder}: ${err}`)
      return null
    }

    const data = await response.json()
    console.log(`[storage] 📸 Slide ${slideOrder} subido: ${data.secure_url}`)
    return data.secure_url
  } catch (error: any) {
    console.error(`[storage] Error uploading slide ${slideOrder}:`, error.message)
    return null
  }
}
