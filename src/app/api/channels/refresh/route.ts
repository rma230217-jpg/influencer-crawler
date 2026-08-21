import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvgViewsOfRecentShorts, fetchChannelDetails } from "@/lib/youtube";

export const maxDuration = 300;

// 등록된 채널을 최신 데이터로 갱신 (3.1 "주기적으로(예: 매일 1회) 최신 데이터로 갱신")
// Vercel Cron이 매일 이 엔드포인트를 호출한다 (vercel.json 참고).
// CRON_SECRET으로 보호되며, RLS를 우회하기 위해 서비스 롤 키를 사용한다.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const { data: channels, error } = await supabase
    .from("channels")
    .select("id, youtube_channel_id")
    .not("youtube_channel_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  // channels.list는 최대 50개까지 배치 조회 가능
  for (let i = 0; i < channels.length; i += 50) {
    const batch = channels.slice(i, i + 50);
    const ids = batch.map((c) => c.youtube_channel_id!).filter(Boolean);

    try {
      const details = await fetchChannelDetails(ids);
      const detailsById = new Map(details.map((d) => [d.youtubeChannelId, d]));

      for (const row of batch) {
        const detail = row.youtube_channel_id ? detailsById.get(row.youtube_channel_id) : undefined;
        if (!detail) {
          results.push({ id: row.id, ok: false, error: "채널을 찾을 수 없음(삭제되었을 수 있음)" });
          continue;
        }

        const { avgViews } = await computeAvgViewsOfRecentShorts(detail.uploadsPlaylistId);
        const { error: updateError } = await supabase
          .from("channels")
          .update({
            channel_name: detail.channelName,
            channel_url: detail.channelUrl,
            subscriber_count: detail.subscriberCount,
            avg_views_last_6_shorts: avgViews,
            contact_email: detail.contactEmail,
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        results.push({ id: row.id, ok: !updateError, error: updateError?.message });
      }
    } catch (batchError) {
      const message = batchError instanceof Error ? batchError.message : "알 수 없는 오류";
      for (const row of batch) results.push({ id: row.id, ok: false, error: message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ total: results.length, failed: failed.length, results });
}
