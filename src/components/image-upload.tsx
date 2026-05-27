"use client"
import { useState, useRef } from "react"
import { Upload, X, Loader2 } from "lucide-react"

export function ImageUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      onChange(url)
    } catch (err) { console.error(err) } finally { setUploading(false) }
  }

  return (
    <div>
      {value ? (
        <div className="relative group">
          <img src={value} alt="Screenshot" className="w-full h-48 object-cover rounded-lg border border-border" />
          <button type="button" onClick={() => onChange(null)} className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading} className="w-full h-48 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-muted-foreground/50 transition-colors cursor-pointer disabled:opacity-50">
          {uploading ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> : <><Upload className="w-8 h-8 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click para subir screenshot</span></>}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  )
}
