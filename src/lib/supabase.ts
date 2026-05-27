import { createClient, SupabaseClient } from "@supabase/supabase-js"

// Lazy initialization para evitar errores en build time
// Los clients se crean solo cuando se los llama (runtime)

let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    _supabaseAdmin = createClient(url, key)
  }
  return _supabaseAdmin
}
