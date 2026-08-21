import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/components/Dashboard";
import { CHANNEL_SELECT, mapChannelRow, type ChannelRow } from "@/lib/channelRow";

// 팀 전체가 공유하는 저장(즐겨찾기) 목록 (9.5)
export default async function SavedChannelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // saved_channels는 임베디드 관계라 PostgREST 컬럼 필터로는 걸러지지 않으므로,
  // 전체 조회 후 저장된 것만 남긴다 (팀 내부용 규모에서는 충분히 빠르다).
  const { data, error } = await supabase
    .from("channels")
    .select(CHANNEL_SELECT)
    .order("subscriber_count", { ascending: false });

  const channels = ((data as ChannelRow[] | null) ?? [])
    .map(mapChannelRow)
    .filter((c) => c.is_saved);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar userEmail={user.email ?? null} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-lg font-semibold text-neutral-900">저장 목록</h1>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            저장 목록을 불러오지 못했습니다: {error.message}
          </p>
        )}
        <Dashboard initialChannels={channels} variant="saved" />
      </main>
    </div>
  );
}
