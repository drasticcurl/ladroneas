/**
 * Sube un screenshot (base64 PNG) a Cloudinary y devuelve la URL.
 * Usa unsigned upload con el preset configurado.
 */
export async function uploadScreenshot(
  funnelId: string,
  slideOrder: number,
  base64: string
): Promise<string | null> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    console.error("[storage] ❌ Missing CLOUDINARY env vars (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)")
    return null
  }

  try {
    const apiUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

    // Cloudinary espera form-data para uploads grandes, no JSON
    const formData = new FormData()
    formData.append("file", `data:image/png;base64,${base64}`)
    formData.append("upload_preset", uploadPreset)
    formData.append("folder", `funnels/${funnelId}`)
    formData.append("public_id", `slide_${String(slideOrder).padStart(2, "0")}`)

    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[storage] ❌ Cloudinary error slide ${slideOrder}: ${err}`)
      return null
    }

    const data = await response.json()
    console.log(`[storage] ✅ Slide ${slideOrder} subido: ${data.secure_url}`)
    return data.secure_url
  } catch (error: any) {
    console.error(`[storage] ❌ Error uploading slide ${slideOrder}:`, error.message)
    return null
  }
}
