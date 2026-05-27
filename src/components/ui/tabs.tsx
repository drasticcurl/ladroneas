"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsCtx { value: string; onChange: (v: string) => void }
const Ctx = React.createContext<TabsCtx>({ value: "", onChange: () => {} })

function Tabs({ defaultValue = "", value, onValueChange, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string; value?: string; onValueChange?: (v: string) => void }) {
  const [int, setInt] = React.useState(defaultValue)
  return <Ctx.Provider value={{ value: value ?? int, onChange: onValueChange ?? setInt }}><div className={cn("", className)} {...props}>{children}</div></Ctx.Provider>
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)} {...props} />
}

function TabsTrigger({ value, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: sel, onChange } = React.useContext(Ctx)
  return <button type="button" onClick={() => onChange(value)} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all", sel === value && "bg-background text-foreground shadow-sm", className)} {...props} />
}

function TabsContent({ value, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: sel } = React.useContext(Ctx)
  if (sel !== value) return null
  return <div className={cn("mt-2", className)} {...props}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
