"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, Zap, ArrowLeft, Save, Terminal } from "lucide-react"
import Link from "next/link"

interface AnalyzedSlide {
  slide_type: string
  question_text: string | null
  options: { text: string; emoji?: string; image_url?: string; notes?: string }[]
  decoration_type: "emojis" | "images" | "none"
  notes: string | null
  style_notes: string | null
  screenshot_base64: string | null
}

interface ExtractionResult {
  slides: AnalyzedSlide[]
  funnel_style_notes: string
  total_questions: number
  ad_copy_insights: string
  landing_url: string
  slides_extracted: number
}

const typeLabels: Record<string, string> = { question: "Pregunta", intro: "Intro", result: "Resultado", offer: "Oferta", prueba_social: "Prueba Social", other: "Otro" }
const typeColors: Record<string, string> = { question: "bg-blue-500/10 text-blue-400 border-blue-500/20", intro: "bg-green-500/10 text-green-400 border-green-500/20", result: "bg-purple-500/10 text-purple-400 border-purple-500/20", offer: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", prueba_social: "bg-orange-500/10 text-orange-400 border-orange-500/20", other: "bg-gray-500/10 text-gray-400 border-gray-500/20" }

export default function ExtractPage() {
  const router = useRouter()
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [jsonInput, setJsonInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editNotes, setEditNotes] = useState("")
  const [editStyleNotes, setEditStyleNotes] = useState("")

  // Manual mode: paste JSON output from CLI
  const handleLoadJson = () => {
    try {
      const data = JSON.parse(jsonInput) as ExtractionResult
      setResult(data)
      setEditStyleNotes(data.funnel_style_notes || "")
      setEditNotes(data.ad_copy_insights || "")
      toast.success("Datos cargados: " + data.slides_extracted + " slides")
    } catch {
      toast.error("JSON invalido")
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const funnelRes = await fetch("/api/funnels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ landing_url: result.landing_url, notes: editNotes, total_questions: result.total_questions, funnel_style_notes: editStyleNotes, format: null, ad_url: null, screenshot_url: null, ad_copy: null, cta: null }) })
      if (!funnelRes.ok) throw new Error("Failed to create funnel")
      const funnel = await funnelRes.json()

      for (let i = 0; i < result.slides.length; i++) {
        const slide = result.slides[i]
        await fetch("/api/slides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funnel_id: funnel.id, slide_order: i + 1, slide_type: slide.slide_type, question_text: slide.question_text, options: slide.options || [], screenshot_url: null, decoration_type: slide.decoration_type || "none", notes: slide.notes, style_notes: slide.style_notes }) })
      }
      toast.success("Funnel guardado")
      router.push("/funnel/" + funnel.id)
    } catch (e: any) { toast.error(e.message || "Error al guardar") } finally { setSaving(false) }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Extractor Automatico</h1><p className="text-muted-foreground text-sm">Extraer quiz funnels automaticamente con AI</p></div>
      </div>

      {!result && (
        <div className="space-y-6">
          {/* Instructions */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Terminal className="w-6 h-6 text-primary" />
                <h2 className="text-lg font-semibold">Como usar el extractor</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                El scraping corre en tu PC (necesita Chrome). Despues la AI analiza los screenshots en el server.
              </p>
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">1. Instala las dependencias (una sola vez):</p>
                <code className="text-sm block bg-background px-3 py-2 rounded border">npm install -D puppeteer tsx</code>
                <p className="text-xs font-medium text-muted-foreground mt-3">2. Corre el extractor con la URL del quiz:</p>
                <code className="text-sm block bg-background px-3 py-2 rounded border">npx tsx scripts/extract.ts &quot;https://quiz-funnel-url.com&quot;</code>
                <p className="text-xs font-medium text-muted-foreground mt-3">3. El script guarda el funnel automaticamente en la DB</p>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                O si queres ver el resultado antes de guardar, pega el JSON de respuesta del API aca abajo:
              </p>
            </CardContent>
          </Card>

          {/* Manual JSON paste */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <Label>Pegar JSON de resultado (opcional)</Label>
              <Textarea
                placeholder='{"slides": [...], "funnel_style_notes": "...", ...}'
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <Button onClick={handleLoadJson} disabled={!jsonInput}>
                <Zap className="w-4 h-4 mr-2" />
                Cargar resultado
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <Card><CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-semibold">Resultado de la Extraccion</h2><p className="text-sm text-muted-foreground">{result.slides_extracted} slides extraidos, {result.total_questions} preguntas detectadas</p></div>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Guardar como Funnel</Button>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Estilo general del funnel</Label><Textarea value={editStyleNotes} onChange={e => setEditStyleNotes(e.target.value)} rows={4} /></div>
              <div className="space-y-2"><Label>Insights de copywriting</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={4} /></div>
            </div>
          </CardContent></Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Slides Extraidos ({result.slides.length})</h3>
            {result.slides.map((slide, i) => (
              <Card key={i} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"><span className="text-sm font-bold">{i + 1}</span></div>
                    <div className="flex-1 min-w-0"><h4 className="font-medium truncate">{slide.question_text || "Slide " + (i + 1)}</h4></div>
                    <span className={"text-xs px-2 py-0.5 rounded border " + (typeColors[slide.slide_type] || typeColors.other)}>{typeLabels[slide.slide_type] || "Otro"}</span>
                    {slide.decoration_type !== "none" && <Badge variant="outline" className="text-xs">{slide.decoration_type === "emojis" ? "Emojis" : "Imagenes"}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {slide.screenshot_base64 && <div><img src={"data:image/png;base64," + slide.screenshot_base64} alt={"Slide " + (i + 1)} className="w-full rounded-lg border border-border" /></div>}
                    <div className="space-y-3">
                      {slide.options && slide.options.length > 0 && (
                        <div><h5 className="text-xs font-medium text-muted-foreground mb-2">OPCIONES</h5><div className="space-y-1.5">{slide.options.map((opt, j) => (<div key={j} className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded">{opt.emoji && <span>{opt.emoji}</span>}<span className="flex-1">{opt.text}</span></div>))}</div></div>
                      )}
                      {slide.notes && <div><h5 className="text-xs font-medium text-muted-foreground mb-1">NOTAS (AI)</h5><p className="text-sm text-muted-foreground">{slide.notes}</p></div>}
                      {slide.style_notes && <div><h5 className="text-xs font-medium text-muted-foreground mb-1">ESTILO (AI)</h5><p className="text-sm text-muted-foreground">{slide.style_notes}</p></div>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving} size="lg">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Guardar como Funnel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
