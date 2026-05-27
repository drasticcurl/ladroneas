"use client"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Image, Video, LayoutGrid, MessageSquare, ExternalLink } from "lucide-react"
import Link from "next/link"

interface Funnel {
  id: string; created_at: string; updated_at: string; ad_url: string | null; screenshot_url: string | null;
  ad_copy: string | null; cta: string | null; landing_url: string | null;
  format: "video" | "imagen" | "carrusel" | null; notes: string | null;
  total_questions: number; funnel_style_notes: string | null;
}

const formatIcons = { video: Video, imagen: Image, carrusel: LayoutGrid }

export function FunnelCard({ funnel }: { funnel: Funnel }) {
  const FormatIcon = funnel.format ? formatIcons[funnel.format] : Image
  return (
    <Link href={`/funnel/${funnel.id}`}>
      <Card className="hover:border-muted-foreground/50 transition-colors cursor-pointer h-full flex flex-col">
        <CardHeader className="p-0">
          {funnel.screenshot_url ? (
            <div className="relative w-full h-40 overflow-hidden rounded-t-lg">
              <img src={funnel.screenshot_url} alt="Ad screenshot" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-40 bg-muted rounded-t-lg flex items-center justify-center">
              <Image className="w-10 h-10 text-muted-foreground" />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 flex-1">
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{funnel.ad_copy || "Sin copy registrado"}</p>
          {funnel.cta && <p className="text-xs font-medium text-primary mb-2">CTA: {funnel.cta}</p>}
        </CardContent>
        <CardFooter className="p-4 pt-0 flex items-center gap-2 flex-wrap">
          {funnel.format && <Badge variant="secondary" className="text-xs"><FormatIcon className="w-3 h-3 mr-1" />{funnel.format}</Badge>}
          {funnel.total_questions > 0 && <Badge variant="secondary" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" />{funnel.total_questions} preguntas</Badge>}
          {funnel.landing_url && <Badge variant="secondary" className="text-xs"><ExternalLink className="w-3 h-3 mr-1" />Funnel</Badge>}
        </CardFooter>
      </Card>
    </Link>
  )
}
