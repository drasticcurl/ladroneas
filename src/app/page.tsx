"use client"
import { useEffect, useState } from "react"
import { FunnelCard } from "@/components/funnel-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Search, Loader2 } from "lucide-react"
import Link from "next/link"

export default function Dashboard() {
  const [funnels, setFunnels] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchFunnels() }, [])

  const fetchFunnels = async (q = "") => {
    setLoading(true)
    try { const p = q ? `?search=${encodeURIComponent(q)}` : ""; const r = await fetch(`/api/funnels${p}`); setFunnels(await r.json()) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchFunnels(search) }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-3xl font-bold">Extractor 123</h1><p className="text-muted-foreground mt-1">Quiz funnels robados del Ad Library</p></div>
        <Link href="/funnel/new"><Button><Plus className="w-4 h-4 mr-2" />Nuevo Funnel</Button></Link>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por copy, notas, CTA..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : funnels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4"><Search className="w-8 h-8 text-muted-foreground" /></div>
          <h3 className="text-lg font-medium mb-2">No hay funnels todavia</h3>
          <p className="text-muted-foreground mb-4">Empeza a robar funnels del Ad Library</p>
          <Link href="/funnel/new"><Button><Plus className="w-4 h-4 mr-2" />Crear el primero</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {funnels.map((f: any) => <FunnelCard key={f.id} funnel={f} />)}
        </div>
      )}
    </div>
  )
}
