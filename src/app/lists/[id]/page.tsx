import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/components/Dashboard";
import { CHANNEL_SELECT, mapChannelRow, type ChannelRow } from "@/lib/channelRow";

// 4. 이름 붙인 목록 상세: 그 목록에 속한 채널만 대시보드와 동일한 UI로 보여준다.
export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (listError || !list) {
    notFound();
  }

  const { data: memberships } = await supabase
    .from("list_channels")
    .select("channel_id")
    .eq("list_id", id);
  const channelIds = (memberships ?? []).map((m) => m.channel_id);

  let channels: ReturnType<typeof mapChannelRow>[] = [];
  if (channelIds.length > 0) {
    const { data } = await supabase.from("channels").select(CHANNEL_SELECT).in("id", channelIds);
    channels = ((data as ChannelRow[] | null) ?? []).map(mapChannelRow);
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar userEmail={user.email ?? null} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Link href="/lists" className="text-sm text-neutral-500 hover:text-neutral-900">
              ← 목록 전체
            </Link>
            <h1 className="mt-1 text-lg font-semibold text-neutral-900">{list.name}</h1>
          </div>
        </div>
        <Dashboard initialChannels={channels} variant="list" listId={id} />
      </main>
    </div>
  );
}
