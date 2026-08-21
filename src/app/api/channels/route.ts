import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAvgViewsOfRecentShorts, fetchChannelDetails } from "@/lib/youtube";
import { classifyCategories } from "@/lib/categorize";
import { CATEGORIES, type Category, type Channel } from "@/lib/types";

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

// 대시보드용 채널 목록 조회 (카테고리 포함)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("channels")
    .select(
      "id, platform, youtube_channel_id, channel_name, channel_url, subscriber_count, avg_views_last_6_shorts, contact_email, last_updated_at, created_at, channel_categories(category)",
    )
    .order("subscriber_count", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const channels: Channel[] = (data as ChannelRow[]).map((row) => ({
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

  return NextResponse.json({ channels });
}

type RegisterBody = {
  // categories를 생략하면 채널명/소개란/최근 업로드 제목 기반으로 자동 분류한다.
  candidates: { youtubeChannelId: string; categories?: Category[] }[];
};

function isValidCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

// 후보 확인 후 신규 채널 등록 (3.1 / 3.4 "신규 채널 추가")
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RegisterBody | null;
  if (!body?.candidates?.length) {
    return NextResponse.json({ error: "등록할 채널이 없습니다." }, { status: 400 });
  }

  for (const candidate of body.candidates) {
    if (!candidate.youtubeChannelId) {
      return NextResponse.json({ error: "채널 정보가 올바르지 않습니다." }, { status: 400 });
    }
    if (candidate.categories && !candidate.categories.every(isValidCategory)) {
      return NextResponse.json({ error: "유효하지 않은 카테고리입니다." }, { status: 400 });
    }
  }

  try {
    const channelIds = body.candidates.map((c) => c.youtubeChannelId);
    const details = await fetchChannelDetails(channelIds);
    const detailsById = new Map(details.map((d) => [d.youtubeChannelId, d]));

    const inserted: { id: string; youtube_channel_id: string }[] = [];

    for (const candidate of body.candidates) {
      const detail = detailsById.get(candidate.youtubeChannelId);
      if (!detail) continue;

      const { avgViews, recentTitles } = await computeAvgViewsOfRecentShorts(detail.uploadsPlaylistId);
      const categories =
        candidate.categories ??
        classifyCategories([detail.channelName, detail.description, ...recentTitles].join(" "));

      const { data: row, error } = await supabase
        .from("channels")
        .upsert(
          {
            platform: "youtube",
            youtube_channel_id: detail.youtubeChannelId,
            channel_name: detail.channelName,
            channel_url: detail.channelUrl,
            subscriber_count: detail.subscriberCount,
            avg_views_last_6_shorts: avgViews,
            contact_email: detail.contactEmail,
            last_updated_at: new Date().toISOString(),
            created_by: user.id,
          },
          { onConflict: "youtube_channel_id" },
        )
        .select("id, youtube_channel_id")
        .single();

      if (error || !row) {
        return NextResponse.json({ error: error?.message ?? "채널 저장에 실패했습니다." }, { status: 500 });
      }

      await supabase.from("channel_categories").delete().eq("channel_id", row.id);
      if (categories.length > 0) {
        const { error: catError } = await supabase
          .from("channel_categories")
          .insert(categories.map((category) => ({ channel_id: row.id, category })));
        if (catError) {
          return NextResponse.json({ error: catError.message }, { status: 500 });
        }
      }

      inserted.push(row);
    }

    return NextResponse.json({ inserted }, { status: 201 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
