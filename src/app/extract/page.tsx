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
import { Loader2, Zap, ArrowLeft, Save, Brain } from "lucide-react"
import Link from "next/link"

interface CostInfo { model: string; input_tokens: number; output_tokens: number; total_tokens: number; input_cost_usd: number; output_cost_usd: number; total_cost_usd: number; elapsed_seconds: number }
interface AnalyzedSlide { slide_type: string; question_text: string | null; options: { text: string; emoji?: string; notes?: string }[]; decoration_type: "emojis" | "images" | "none"; notes: string | null; style_notes: string | null; screenshot_base64: string | null }
interface RawScreenshot { base64: string; text: string; html: string }
interface AnalysisResult { slides: AnalyzedSlide[]; funnel_style_notes: string; total_questions: number; ad_copy_insights: string; cost?: CostInfo }
type Status = "idle" | "extracting" | "extracted" | "analyzing" | "done" | "error"

const typeLabels: Record<string, string> = { question: "Pregunta", intro: "Intro", result: "Resultado", offer: "Oferta", prueba_social: "Prueba Social", other: "Otro" }
const typeColors: Record<string, string> = { question: "bg-blue-500/10 text-blue-400 border-blue-500/20", intro: "bg-green-500/10 text-green-400 border-green-500/20", result: "bg-purple-500/10 text-purple-400 border-purple-500/20", offer: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", prueba_social: "bg-orange-500/10 text-orange-400 border-orange-500/20", other: "bg-gray-500/10 text-gray-400 border-gray-500/20" }

const MODELS = [
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", desc: "$0.40/1M in" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini", desc: "$0.50/1M in" },
]

export default function ExtractPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [screenshots, setScreenshots] = useState<RawScreenshot[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [editNotes, setEditNotes] = useState("")
  const [editStyleNotes, setEditStyleNotes] = useState("")
  const [maxSlides, setMaxSlides] = useState(30)
  const [delayPerSlide, setDelayPerSlide] = useState(3)
  const [model, setModel] = useState("gpt-4.1-mini")
  const [landingUrl, setLandingUrl] = useState("")

  const handleExtract = async () => {
    if (!url) return
    setStatus("extracting"); setError(""); setResult(null); setScreenshots([])
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, maxSlides, delayPerSlide }) })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Extraction failed") }
      const data = await res.json()
      setScreenshots(data.screenshots)
      setLandingUrl(data.landing_url)
      setStatus("extracted")
      toast.success(`${data.slides_extracted} slides extraidos. Elegí modelo e inicia el análisis.`)
    } catch (e: any) { setStatus("error"); setError(e.message); toast.error(e.message) }
  }

  const handleAnalyze = async () => {
    if (screenshots.length === 0) return
    setStatus("analyzing"); setError("")
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ screenshots, model }) })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Analysis failed") }
      const data: AnalysisResult = await res.json()
      setResult(data); setEditStyleNotes(data.funnel_style_notes || ""); setEditNotes(data.ad_copy_insights || ""); setStatus("done")
      const costMsg = data.cost ? ` ($${data.cost.total_cost_usd.toFixed(4)})` : ""
      toast.success(`Análisis completado${costMsg}`)
    } catch (e: any) { setStatus("error"); setError(e.message); toast.error(e.message) }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const funnelRes = await fetch("/api/funnels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ landing_url: landingUrl, notes: editNotes, total_questions: result.total_questions, funnel_style_notes: editStyleNotes, format: null, ad_url: null, screenshot_url: null, ad_copy: null, cta: null }) })
      if (!funnelRes.ok) throw new Error("Failed to create funnel")
      const funnel = await funnelRes.json()
      for (let i = 0; i < result.slides.length; i++) {
        const slide = result.slides[i]
        await fetch("/api/slides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funnel_id: funnel.id, slide_order: i + 1, slide_type: slide.slide_type, question_text: slide.question_text, options: slide.options || [], screenshot_base64: slide.screenshot_base64 || null, decoration_type: slide.decoration_type || "none", notes: slide.notes, style_notes: slide.style_notes }) })
      }
      toast.success("Funnel guardado"); router.push("/funnel/" + funnel.id)
    } catch (e: any) { toast.error(e.message || "Error al guardar") } finally { setSaving(false) }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Extractor Automatico</h1><p className="text-muted-foreground text-sm">Pega la URL de un quiz funnel y extraigo todo con AI</p></div>
      </div>

      <div className="flex gap-3 mb-8">
        <Input placeholder="https://quiz-funnel-de-competidor.com..." value={url} onChange={e => setUrl(e.target.value)} disabled={status === "extracting" || status === "analyzing"} className="flex-1" onKeyDown={e => { if (e.key === "Enter") handleExtract() }} />
        <Input type="number" min={5} max={60} value={maxSlides} onChange={e => setMaxSlides(Number(e.target.value) || 30)} disabled={status === "extracting" || status === "analyzing"} className="w-20" title="Max slides" />
        <Input type="number" min={1} max={30} value={delayPerSlide} onChange={e => setDelayPerSlide(Number(e.target.value) || 3)} disabled={status === "extracting" || status === "analyzing"} className="w-20" title="Segundos de espera por slide" />
        <Button onClick={handleExtract} disabled={!url || status === "extracting" || status === "analyzing"}>{status === "extracting" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}Extraer</Button>
      </div>

      {status === "extracting" && (
        <Card className="mb-8"><CardContent className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          <div><p className="font-semibold text-lg">Extrayendo slides...</p><p className="text-sm text-muted-foreground mt-1">Navegando el quiz y capturando screenshots de cada slide.</p><p className="text-sm text-muted-foreground">Puede tardar 30s-2min dependiendo del quiz.</p></div>
        </CardContent></Card>
      )}

      {status === "analyzing" && (
        <Card className="mb-8"><CardContent className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
          <div><p className="font-semibold text-lg">Analizando con {MODELS.find(m => m.value === model)?.label}...</p><p className="text-sm text-muted-foreground mt-1">Enviando {screenshots.length} slides para análisis de copy, psicología y diseño.</p><p className="text-sm text-muted-foreground">30-60 segundos.</p></div>
        </CardContent></Card>
      )}

      {status === "error" && (
        <Card className="mb-8 border-destructive/50"><CardContent className="p-6">
          <p className="font-medium text-destructive mb-1">Error</p><p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setStatus(screenshots.length > 0 ? "extracted" : "idle")}>Intentar de nuevo</Button>
        </CardContent></Card>
      )}

      {/* Post-extraction: show raw slides + model selector + analyze button */}
      {(status === "extracted" || status === "analyzing" || status === "done") && screenshots.length > 0 && !result && (
        <div className="space-y-6">
          <Card className="border-blue-500/20 bg-blue-500/5"><CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-semibold">{screenshots.length} slides extraidos</h2><p className="text-sm text-muted-foreground">Elegí el modelo de AI y lanzá el análisis</p></div>
              <div className="flex items-center gap-3">
                <select value={model} onChange={e => setModel(e.target.value)} disabled={status === "analyzing"} className="bg-background border border-border rounded-md px-3 py-2 text-sm">
                  {MODELS.map(m => <option key={m.value} value={m.value}>{m.label} ({m.desc})</option>)}
                </select>
                <Button onClick={handleAnalyze} disabled={status === "analyzing"}>{status === "analyzing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}Iniciar Análisis</Button>
              </div>
            </div>
          </CardContent></Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {screenshots.map((s, i) => (
              <div key={i} className="relative">
                <img src={"data:image/png;base64," + s.base64} alt={`Slide ${i + 1}`} className="w-full rounded-lg border border-border" />
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-analysis results */}
      {result && (
        <div className="space-y-6">
          <Card className="border-green-500/20 bg-green-500/5"><CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-semibold">Análisis completado</h2><p className="text-sm text-muted-foreground">{result.slides.length} slides &middot; {result.total_questions} preguntas</p></div>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Guardar como Funnel</Button>
            </div>

            {result.cost && (
              <div className="bg-background/50 rounded-lg border border-border p-4 mb-4">
                <div className="flex items-center gap-2 mb-2"><span className="text-sm font-medium">Costo del análisis</span><Badge variant="outline" className="text-xs">{result.cost.model}</Badge></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Input tokens</p><p className="font-mono font-medium">{result.cost.input_tokens.toLocaleString()}</p><p className="text-xs text-muted-foreground">${result.cost.input_cost_usd.toFixed(4)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Output tokens</p><p className="font-mono font-medium">{result.cost.output_tokens.toLocaleString()}</p><p className="text-xs text-muted-foreground">${result.cost.output_cost_usd.toFixed(4)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Total</p><p className="font-mono font-medium text-green-400">{result.cost.total_tokens.toLocaleString()}</p><p className="text-xs font-semibold text-green-400">${result.cost.total_cost_usd.toFixed(4)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Tiempo</p><p className="font-mono font-medium">{result.cost.elapsed_seconds.toFixed(1)}s</p><p className="text-xs text-muted-foreground">{Math.round(result.cost.output_tokens / result.cost.elapsed_seconds)} tok/s</p></div>
                </div>
              </div>
            )}

            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Estilo general (editable)</Label><Textarea value={editStyleNotes} onChange={e => setEditStyleNotes(e.target.value)} rows={6} /></div>
              <div className="space-y-2"><Label>Insights de copy (editable)</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={6} /></div>
            </div>
          </CardContent></Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Slides ({result.slides.length})</h3>
            {result.slides.map((slide, i) => (
              <Card key={i} className="border-border">
                <CardHeader className="pb-3"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"><span className="text-sm font-bold">{i + 1}</span></div>
                  <div className="flex-1 min-w-0"><h4 className="font-medium truncate">{slide.question_text || "Slide " + (i + 1)}</h4></div>
                  <span className={"text-xs px-2 py-0.5 rounded border " + (typeColors[slide.slide_type] || typeColors.other)}>{typeLabels[slide.slide_type] || "Otro"}</span>
                  {slide.decoration_type !== "none" && <Badge variant="outline" className="text-xs">{slide.decoration_type === "emojis" ? "Emojis" : "Imagenes"}</Badge>}
                </div></CardHeader>
                <CardContent className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {slide.screenshot_base64 && <div><img src={"data:image/png;base64," + slide.screenshot_base64} alt={"Slide " + (i + 1)} className="w-full rounded-lg border border-border" /></div>}
                  <div className="space-y-3">
                    {slide.options && slide.options.length > 0 && (<div><h5 className="text-xs font-medium text-muted-foreground mb-2">OPCIONES</h5><div className="space-y-1.5">{slide.options.map((opt, j) => (<div key={j} className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded">{opt.emoji && <span>{opt.emoji}</span>}<span className="flex-1">{opt.text}</span></div>))}</div></div>)}
                    {slide.notes && <div><h5 className="text-xs font-medium text-muted-foreground mb-1">COPY / PSICOLOGIA</h5><p className="text-sm text-muted-foreground">{slide.notes}</p></div>}
                    {slide.style_notes && <div><h5 className="text-xs font-medium text-muted-foreground mb-1">ESTILOS DETALLADOS</h5><p className="text-sm text-muted-foreground whitespace-pre-wrap">{slide.style_notes}</p></div>}
                  </div>
                </div></CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end pt-4 pb-8">
            <Button onClick={handleSave} disabled={saving} size="lg">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Guardar como Funnel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
