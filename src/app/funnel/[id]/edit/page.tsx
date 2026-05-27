"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { FunnelForm } from "@/components/funnel-form"
import { Loader2 } from "lucide-react"

export default function EditFunnelPage() {
  const params = useParams()
  const [funnel, setFunnel] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch(`/api/funnels/${params.id}`).then(r => r.json()).then(setFunnel).catch(console.error).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  if (!funnel) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Funnel no encontrado</p></div>
  return <div className="container mx-auto px-4 py-8 max-w-5xl"><FunnelForm funnel={funnel} mode="edit" /></div>
}
