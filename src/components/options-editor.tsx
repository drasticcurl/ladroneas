"use client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"

interface SlideOption { text: string; emoji?: string; image_url?: string; notes?: string }

export function OptionsEditor({ options, decorationType, onChange }: { options: SlideOption[]; decorationType: string; onChange: (o: SlideOption[]) => void }) {
  const add = () => onChange([...options, { text: "" }])
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof SlideOption, val: string) => {
    const u = [...options]; u[i] = { ...u[i], [field]: val }; onChange(u)
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          {decorationType === "emojis" && <Input placeholder="🏠" value={opt.emoji || ""} onChange={e => update(i, "emoji", e.target.value)} className="w-14 text-center" />}
          {decorationType === "images" && <Input placeholder="URL img" value={opt.image_url || ""} onChange={e => update(i, "image_url", e.target.value)} className="w-32" />}
          <Input placeholder={`Opcion ${i + 1}`} value={opt.text} onChange={e => update(i, "text", e.target.value)} className="flex-1" />
          <Input placeholder="Nota" value={opt.notes || ""} onChange={e => update(i, "notes", e.target.value)} className="w-32" />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} className="shrink-0 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Agregar opcion</Button>
    </div>
  )
}
