"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SlideList } from "@/components/slide-list"
import { SlidePreview } from "@/components/slide-preview"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Edit, Trash2, ExternalLink, Image, Video, LayoutGrid, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function FunnelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [funnel, setFunnel] = useState<any>(null)
  const [slides, setSlides] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/funnels/${params.id}`).then(r => r.json()),
      fetch(`/api/slides?funnel_id=${params.id}`).then(r => r.json()),
    ]).then(([f, s]) => { setFunnel(f); setSlides(s) }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleDelete = async () => {
    if (!confirm("Seguro que queres eliminar este funnel?")) return
    await fetch(`/api/funnels/${params.id}`, { method: "DELETE" })
    toast.success("Funnel eliminado"); router.push("/")
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  if (!funnel) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Funnel no encontrado</p></div>

  const formatIcons: any = { video: Video, imagen: Image, carrusel: LayoutGrid }
  const FormatIcon = funnel.format ? formatIcons[funnel.format] : Image

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div><h1 className="text-2xl font-bold">Detalle del Funnel</h1><p className="text-sm text-muted-foreground">Creado {new Date(funnel.created_at).toLocaleDateString("es-AR")}</p></div>
        </div>
        <div className="flex gap-2">
          <Link href={`/funnel/${funnel.id}/edit`}><Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-1" />Editar</Button></Link>
          <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Eliminar</Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Info del Anuncio</TabsTrigger>
          <TabsTrigger value="slides">Slides ({slides.length})</TabsTrigger>
          <TabsTrigger value="editor">Editor de Slides</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              {funnel.screenshot_url ? <img src={funnel.screenshot_url} alt="Ad" className="w-full rounded-lg border border-border" /> : <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center"><Image className="w-12 h-12 text-muted-foreground" /></div>}
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {funnel.format && <Badge variant="secondary"><FormatIcon className="w-3 h-3 mr-1" />{funnel.format}</Badge>}
                {funnel.total_questions > 0 && <Badge variant="secondary">{funnel.total_questions} preguntas</Badge>}
              </div>
              {funnel.ad_copy && <div><h3 className="text-sm font-medium text-muted-foreground mb-1">Copy del anuncio</h3><p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{funnel.ad_copy}</p></div>}
              {funnel.cta && <div><h3 className="text-sm font-medium text-muted-foreground mb-1">CTA</h3><p className="text-sm font-medium">{funnel.cta}</p></div>}
              <div className="flex flex-col gap-2">
                {funnel.ad_url && <a href={funnel.ad_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"><ExternalLink className="w-3 h-3" />Ver en Ad Library</a>}
                {funnel.landing_url && <a href={funnel.landing_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"><ExternalLink className="w-3 h-3" />Ver Quiz Funnel</a>}
              </div>
              <Separator />
              {funnel.notes && <div><h3 className="text-sm font-medium text-muted-foreground mb-1">Notas</h3><p className="text-sm whitespace-pre-wrap">{funnel.notes}</p></div>}
              {funnel.funnel_style_notes && <div><h3 className="text-sm font-medium text-muted-foreground mb-1">Estilo General</h3><p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{funnel.funnel_style_notes}</p></div>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="slides" className="space-y-4">
          {slides.length === 0 ? <div className="text-center py-12 text-muted-foreground"><p className="mb-2">No hay slides registrados</p><p className="text-sm">Usa el tab Editor de Slides para agregar</p></div> : slides.map((s: any, i: number) => <SlidePreview key={s.id} slide={s} index={i} />)}
        </TabsContent>

        <TabsContent value="editor"><SlideList funnelId={funnel.id} /></TabsContent>
      </Tabs>
    </div>
  )
}
