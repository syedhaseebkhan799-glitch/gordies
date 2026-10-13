import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(url && key && !url.includes("YOUR-PROJECT"));

// Session is kept in localStorage, so users stay logged in after closing the app.
export const supabase = createClient(
  supabaseConfigured ? url : "https://placeholder.supabase.co",
  supabaseConfigured ? key : "placeholder",
  { auth: { persistSession: true, autoRefreshToken: true } },
);
