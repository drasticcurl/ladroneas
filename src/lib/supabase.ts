import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client para el frontend (usa anon key, respeta RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client para API routes server-side (bypasea RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
