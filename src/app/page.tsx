import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/components/Dashboard";
import type { Category, Channel } from "@/lib/types";

type ChannelRow = {
  id: string;
  platform: string;
  youtube_channel_id: string | null;
  channel_name: string;
  channel_url: string;
  subscriber_count: number;
  avg_views_last_6_shorts: number | null;
  contact_email: string | null;
  last_updated_at: string;
  created_at: string;
  channel_categories: { category: Category }[];
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("channels")
    .select(
      "id, platform, youtube_channel_id, channel_name, channel_url, subscriber_count, avg_views_last_6_shorts, contact_email, last_updated_at, created_at, channel_categories(category)",
    )
    .order("subscriber_count", { ascending: false });

  const channels: Channel[] = ((data as ChannelRow[] | null) ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    youtube_channel_id: row.youtube_channel_id,
    channel_name: row.channel_name,
    channel_url: row.channel_url,
    subscriber_count: row.subscriber_count,
    avg_views_last_6_shorts: row.avg_views_last_6_shorts,
    contact_email: row.contact_email,
    last_updated_at: row.last_updated_at,
    created_at: row.created_at,
    categories: row.channel_categories.map((c) => c.category),
  }));

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar userEmail={user.email ?? null} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            채널 목록을 불러오지 못했습니다: {error.message}
          </p>
        )}
        <Dashboard initialChannels={channels} />
      </main>
    </div>
  );
}
