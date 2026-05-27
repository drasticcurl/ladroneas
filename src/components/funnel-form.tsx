"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageUpload } from "@/components/image-upload"
import { toast } from "sonner"
import { Save, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

interface Funnel {
  id: string; created_at: string; updated_at: string; ad_url: string | null; screenshot_url: string | null;
  ad_copy: string | null; cta: string | null; landing_url: string | null;
  format: "video" | "imagen" | "carrusel" | null; notes: string | null;
  total_questions: number; funnel_style_notes: string | null;
}

interface FormData {
  ad_url: string | null; screenshot_url: string | null; ad_copy: string | null;
  cta: string | null; landing_url: string | null; format: string | null;
  notes: string | null; total_questions: number; funnel_style_notes: string | null;
}

export function FunnelForm({ funnel, mode }: { funnel?: Funnel; mode: "create" | "edit" }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>({
    ad_url: funnel?.ad_url || null, screenshot_url: funnel?.screenshot_url || null,
    ad_copy: funnel?.ad_copy || null, cta: funnel?.cta || null,
    landing_url: funnel?.landing_url || null, format: funnel?.format || null,
    notes: funnel?.notes || null, total_questions: funnel?.total_questions || 0,
    funnel_style_notes: funnel?.funnel_style_notes || null,
  })

  const set = (field: keyof FormData, value: string | number | null) => setForm(p => ({ ...p, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = mode === "create" ? "/api/funnels" : `/api/funnels/${funnel!.id}`
      const res = await fetch(url, { method: mode === "create" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      toast.success(mode === "create" ? "Funnel creado" : "Funnel actualizado")
      router.push(mode === "create" ? `/funnel/${data.id}` : `/funnel/${funnel!.id}`)
    } catch { toast.error("Error al guardar") } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={funnel ? `/funnel/${funnel.id}` : "/"}><Button type="button" variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold">{mode === "create" ? "Nuevo Funnel" : "Editar Funnel"}</h1>
        </div>
        <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Guardar</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2"><Label>Screenshot del anuncio</Label><ImageUpload value={form.screenshot_url} onChange={url => set("screenshot_url", url)} /></div>
          <div className="space-y-2"><Label htmlFor="ad_copy">Copy del anuncio</Label><Textarea id="ad_copy" placeholder="Pega el texto del anuncio..." value={form.ad_copy || ""} onChange={e => set("ad_copy", e.target.value || null)} rows={5} /></div>
          <div className="space-y-2"><Label htmlFor="cta">CTA</Label><Input id="cta" placeholder="Ej: Hace el quiz gratis" value={form.cta || ""} onChange={e => set("cta", e.target.value || null)} /></div>
          <div className="space-y-2"><Label>Formato</Label><Select value={form.format || ""} onValueChange={v => set("format", v || null)}><SelectTrigger><SelectValue placeholder="Seleccionar formato" /></SelectTrigger><SelectContent><SelectItem value="imagen">Imagen</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="carrusel">Carrusel</SelectItem></SelectContent></Select></div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="ad_url">URL del Ad Library</Label><Input id="ad_url" placeholder="https://www.facebook.com/ads/library/..." value={form.ad_url || ""} onChange={e => set("ad_url", e.target.value || null)} /></div>
          <div className="space-y-2"><Label htmlFor="landing_url">URL del Quiz Funnel</Label><Input id="landing_url" placeholder="https://..." value={form.landing_url || ""} onChange={e => set("landing_url", e.target.value || null)} /></div>
          <div className="space-y-2"><Label htmlFor="total_questions">Cantidad de preguntas</Label><Input id="total_questions" type="number" min={0} value={form.total_questions} onChange={e => set("total_questions", parseInt(e.target.value) || 0)} /></div>
          <div className="space-y-2"><Label htmlFor="notes">Notas personales</Label><Textarea id="notes" placeholder="Tus observaciones..." value={form.notes || ""} onChange={e => set("notes", e.target.value || null)} rows={4} /></div>
          <div className="space-y-2"><Label htmlFor="style">Estilo general del funnel</Label><Textarea id="style" placeholder="Colores, tipografia, vibe general..." value={form.funnel_style_notes || ""} onChange={e => set("funnel_style_notes", e.target.value || null)} rows={4} /></div>
        </div>
      </div>
    </form>
  )
}
