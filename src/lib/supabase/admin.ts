import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// 서버 전용 관리자 클라이언트. RLS를 우회하므로 절대 클라이언트 번들에 포함되거나
// 라우트 핸들러 밖(예: 컴포넌트)에서 사용되어서는 안 된다. 매일 자동 갱신(cron)에서만 사용.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되어 있지 않습니다.");
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
