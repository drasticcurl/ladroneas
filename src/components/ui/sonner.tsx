"use client"
import { Toaster as SonnerToaster } from "sonner"
function Toaster() {
  return <SonnerToaster theme="dark" position="bottom-right" toastOptions={{ classNames: { toast: "bg-card border-border text-card-foreground" } }} />
}
export { Toaster }
