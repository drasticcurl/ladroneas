"use client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SlideOption { text: string; emoji?: string; image_url?: string; notes?: string }
interface FunnelSlide {
  id: string; funnel_id: string; slide_order: number;
  slide_type: "question" | "intro" | "result" | "offer" | "other";
  question_text: string | null; options: SlideOption[];
  screenshot_url: string | null; decoration_type: "emojis" | "images" | "none";
  notes: string | null; style_notes: string | null;
}

const typeLabels: Record<string, string> = { question: "Pregunta", intro: "Intro", result: "Resultado", offer: "Oferta", other: "Otro" }
const typeColors: Record<string, string> = { question: "bg-blue-500/10 text-blue-400 border-blue-500/20", intro: "bg-green-500/10 text-green-400 border-green-500/20", result: "bg-purple-500/10 text-purple-400 border-purple-500/20", offer: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", other: "bg-gray-500/10 text-gray-400 border-gray-500/20" }

export function SlidePreview({ slide, index }: { slide: FunnelSlide; index: number }) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"><span className="text-sm font-bold">{index + 1}</span></div>
          <div className="flex-1 min-w-0"><h3 className="font-medium truncate">{slide.question_text || `Slide ${index + 1}`}</h3></div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded border ${typeColors[slide.slide_type]}`}>{typeLabels[slide.slide_type]}</span>
            {slide.decoration_type !== "none" && <Badge variant="outline" className="text-xs">{slide.decoration_type === "emojis" ? "Emojis" : "Imagenes"}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slide.screenshot_url && <div><img src={slide.screenshot_url} alt={`Slide ${index + 1}`} className="w-full rounded-lg border border-border" /></div>}
          <div className="space-y-3">
            {slide.options && slide.options.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">OPCIONES</h4>
                <div className="space-y-1.5">
                  {slide.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded">
                      {o.emoji && <span>{o.emoji}</span>}
                      {o.image_url && <img src={o.image_url} alt="" className="w-5 h-5 rounded object-cover" />}
                      <span className="flex-1">{o.text}</span>
                      {o.notes && <span className="text-xs text-muted-foreground italic">{o.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {slide.notes && <div><h4 className="text-xs font-medium text-muted-foreground mb-1">NOTAS</h4><p className="text-sm text-muted-foreground">{slide.notes}</p></div>}
            {slide.style_notes && <div><h4 className="text-xs font-medium text-muted-foreground mb-1">ESTILO</h4><p className="text-sm text-muted-foreground">{slide.style_notes}</p></div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
