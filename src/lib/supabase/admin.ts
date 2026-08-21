import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/env";

// 서버 전용 관리자 클라이언트. RLS를 우회하므로 절대 클라이언트 번들에 포함되거나
// 라우트 핸들러 밖(예: 컴포넌트)에서 사용되어서는 안 된다. 매일 자동 갱신(cron)에서만 사용.
export function createAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
