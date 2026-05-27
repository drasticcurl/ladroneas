"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface SelectCtx { value: string; onValueChange: (v: string) => void; open: boolean; setOpen: (o: boolean) => void }
const Ctx = React.createContext<SelectCtx>({ value: "", onValueChange: () => {}, open: false, setOpen: () => {} })

function Select({ value = "", onValueChange = () => {}, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return <Ctx.Provider value={{ value, onValueChange, open, setOpen }}><div className="relative">{children}</div></Ctx.Provider>
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(Ctx)
  return <button ref={ref} type="button" onClick={() => setOpen(!open)} className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring", className)} {...props}>{children}<ChevronDown className="h-4 w-4 opacity-50" /></button>
})
SelectTrigger.displayName = "SelectTrigger"

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(Ctx)
  return <span className={!value ? "text-muted-foreground" : ""}>{value || placeholder}</span>
}

function SelectContent({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(Ctx)
  React.useEffect(() => { if (open) { const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-sc]")) setOpen(false) }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h) } }, [open, setOpen])
  if (!open) return null
  return <div data-sc className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"><div className="p-1">{children}</div></div>
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const { value: sel, onValueChange, setOpen } = React.useContext(Ctx)
  return <button type="button" onClick={() => { onValueChange(value); setOpen(false) }} className={cn("relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent", sel === value && "bg-accent")}>{children}</button>
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
