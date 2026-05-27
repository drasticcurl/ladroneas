"use client"
import { useState, useEffect } from "react"
import { SlideEditor } from "@/components/slide-editor"
import { Button } from "@/components/ui/button"
import { Plus, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface SlideOption { text: string; emoji?: string; image_url?: string; notes?: string }
interface FunnelSlide {
  id: string; funnel_id: string; slide_order: number;
  slide_type: "question" | "intro" | "result" | "offer" | "other";
  question_text: string | null; options: SlideOption[];
  screenshot_url: string | null; decoration_type: "emojis" | "images" | "none";
  notes: string | null; style_notes: string | null;
}

export function SlideList({ funnelId }: { funnelId: string }) {
  const [slides, setSlides] = useState<FunnelSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  useEffect(() => { fetchSlides() }, [funnelId])

  const fetchSlides = async () => {
    try { const r = await fetch(`/api/slides?funnel_id=${funnelId}`); setSlides(await r.json()) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const addSlide = () => {
    setSlides([...slides, { id: `temp-${Date.now()}`, funnel_id: funnelId, slide_order: slides.length + 1, slide_type: "question", question_text: null, options: [], screenshot_url: null, decoration_type: "none", notes: null, style_notes: null }])
  }

  const duplicate = (i: number) => {
    const u = [...slides]; u.splice(i + 1, 0, { ...slides[i], id: `temp-${Date.now()}` })
    setSlides(u.map((s, idx) => ({ ...s, slide_order: idx + 1 })))
  }

  const remove = async (i: number) => {
    const s = slides[i]
    if (!s.id.startsWith("temp-")) { try { await fetch(`/api/slides/${s.id}`, { method: "DELETE" }) } catch {} }
    setSlides(slides.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, slide_order: idx + 1 })))
  }

  const update = (i: number, s: FunnelSlide) => { const u = [...slides]; u[i] = s; setSlides(u) }

  const handleDragStart = (i: number) => setDragIdx(i)
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const u = [...slides]; const [d] = u.splice(dragIdx, 1); u.splice(i, 0, d)
    setSlides(u.map((s, idx) => ({ ...s, slide_order: idx + 1 }))); setDragIdx(i)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i]
        const payload = { funnel_id: funnelId, slide_order: i + 1, slide_type: s.slide_type, question_text: s.question_text, options: s.options, screenshot_url: s.screenshot_url, decoration_type: s.decoration_type, notes: s.notes, style_notes: s.style_notes }
        if (s.id.startsWith("temp-")) {
          const r = await fetch("/api/slides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
          if (r.ok) slides[i] = await r.json()
        } else {
          await fetch(`/api/slides/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        }
      }
      toast.success("Slides guardados"); fetchSlides()
    } catch { toast.error("Error al guardar") } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Slides del Funnel ({slides.length})</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addSlide}><Plus className="w-4 h-4 mr-1" />Agregar Slide</Button>
          <Button type="button" size="sm" onClick={saveAll} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Guardar Slides</Button>
        </div>
      </div>
      {slides.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg"><p className="mb-2">No hay slides todavia</p><Button type="button" variant="outline" size="sm" onClick={addSlide}><Plus className="w-4 h-4 mr-1" />Agregar el primero</Button></div>
      ) : (
        <div className="space-y-3">
          {slides.map((s, i) => (
            <div key={s.id} draggable onDragStart={() => handleDragStart(i)} onDragOver={e => handleDragOver(e, i)} onDragEnd={() => setDragIdx(null)} className={dragIdx === i ? "opacity-50" : ""}>
              <SlideEditor slide={s} index={i} onChange={u => update(i, u)} onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
