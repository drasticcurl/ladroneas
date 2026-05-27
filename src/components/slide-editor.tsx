"use client"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ImageUpload } from "@/components/image-upload"
import { OptionsEditor } from "@/components/options-editor"
import { GripVertical, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react"

interface SlideOption { text: string; emoji?: string; image_url?: string; notes?: string }
interface FunnelSlide {
  id: string; funnel_id: string; slide_order: number;
  slide_type: "question" | "intro" | "result" | "offer" | "other";
  question_text: string | null; options: SlideOption[];
  screenshot_url: string | null; decoration_type: "emojis" | "images" | "none";
  notes: string | null; style_notes: string | null;
}

const typeLabels: Record<string, string> = { question: "Pregunta", intro: "Intro", result: "Resultado", offer: "Oferta", other: "Otro" }

export function SlideEditor({ slide, index, onChange, onDuplicate, onDelete }: { slide: FunnelSlide; index: number; onChange: (s: FunnelSlide) => void; onDuplicate: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(true)
  const upd = (field: string, value: unknown) => onChange({ ...slide, [field]: value })

  return (
    <Card className="border-border">
      <CardHeader className="p-3 flex flex-row items-center gap-2">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground"><GripVertical className="w-5 h-5" /></div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
          <span className="text-sm font-medium truncate">{slide.question_text || typeLabels[slide.slide_type]}</span>
          <span className="text-xs px-2 py-0.5 bg-secondary rounded text-muted-foreground">{typeLabels[slide.slide_type]}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de slide</Label>
              <Select value={slide.slide_type} onValueChange={v => upd("slide_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intro">Intro</SelectItem>
                  <SelectItem value="question">Pregunta</SelectItem>
                  <SelectItem value="result">Resultado</SelectItem>
                  <SelectItem value="offer">Oferta</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Screenshot</Label>
              <ImageUpload value={slide.screenshot_url} onChange={url => upd("screenshot_url", url)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Texto de la pregunta / titulo</Label>
            <Input placeholder="Ej: Cuanto facturas por mes?" value={slide.question_text || ""} onChange={e => upd("question_text", e.target.value || null)} />
          </div>
          <div className="space-y-3">
            <Label>Decoracion de respuestas</Label>
            <div className="flex items-center gap-4">
              {(["none", "emojis", "images"] as const).map(t => (
                <button key={t} type="button" onClick={() => upd("decoration_type", t)} className={`px-3 py-1.5 rounded text-sm border transition-colors ${slide.decoration_type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                  {t === "none" ? "Nada" : t === "emojis" ? "Emojis" : "Imagenes"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Opciones de respuesta</Label>
            <OptionsEditor options={slide.options || []} decorationType={slide.decoration_type} onChange={o => upd("options", o)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Notas</Label><Textarea placeholder="Observaciones..." value={slide.notes || ""} onChange={e => upd("notes", e.target.value || null)} rows={3} /></div>
            <div className="space-y-2"><Label>Notas de estilo</Label><Textarea placeholder="Diseno, colores..." value={slide.style_notes || ""} onChange={e => upd("style_notes", e.target.value || null)} rows={3} /></div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
