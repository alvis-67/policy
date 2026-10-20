import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('缺少 Supabase 設定。請在 .env.local 填上 VITE_SUPABASE_URL 同 VITE_SUPABASE_ANON_KEY。')
}

export const supabase = createClient(url, anonKey)
