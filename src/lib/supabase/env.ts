// Supabase는 2025년부터 anon/service_role 키를 publishable/secret 키로 대체하고 있다
// (레거시 키는 2026년 말 폐지 예정). 새로 만든 프로젝트는 publishable/secret 키만 발급되므로
// 이를 우선 사용하고, 레거시 프로젝트를 위해 anon/service_role도 폴백으로 지원한다.

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되어 있지 않습니다.");
  return url;
}

export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY(또는 레거시 NEXT_PUBLIC_SUPABASE_ANON_KEY) 환경변수가 설정되어 있지 않습니다.",
    );
  }
  return key;
}

export function getSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY(또는 레거시 SUPABASE_SERVICE_ROLE_KEY) 환경변수가 설정되어 있지 않습니다.",
    );
  }
  return key;
}
