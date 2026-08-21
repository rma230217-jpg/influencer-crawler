import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// 서버 컴포넌트 / 라우트 핸들러에서 로그인한 사용자 세션으로 Supabase에 접근할 때 사용.
// RLS 정책을 그대로 따르므로 팀원 로그인 여부에 따라 접근이 제한된다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출된 경우 쿠키 쓰기가 무시될 수 있음(미들웨어가 세션 갱신을 담당).
          }
        },
      },
    },
  );
}
