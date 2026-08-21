import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAvgViewsOfRecentShorts, fetchChannelDetails, searchChannelIds } from "@/lib/youtube";
import { classifyCategories } from "@/lib/categorize";
import type { ChannelCandidate } from "@/lib/types";

// 키워드 검색 -> 채널 후보 목록 반환 (3.1 "키워드 검색 → 후보 등록 → 상세 정보 수집")
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "검색어(q)가 필요합니다." }, { status: 400 });
  }

  try {
    const channelIds = await searchChannelIds(query);
    const details = await fetchChannelDetails(channelIds);

    const { data: existing } = await supabase
      .from("channels")
      .select("youtube_channel_id")
      .in("youtube_channel_id", channelIds);
    const existingIds = new Set((existing ?? []).map((c) => c.youtube_channel_id));

    const candidates: ChannelCandidate[] = await Promise.all(
      details.map(async (d) => {
        const { avgViews, recentTitles } = await computeAvgViewsOfRecentShorts(d.uploadsPlaylistId);
        const suggestedCategories = classifyCategories(
          [d.channelName, d.description, ...recentTitles].join(" "),
        );
        return {
          youtubeChannelId: d.youtubeChannelId,
          channelName: d.channelName,
          channelUrl: d.channelUrl,
          thumbnailUrl: d.thumbnailUrl,
          description: d.description,
          subscriberCount: d.subscriberCount,
          avgViewsLast6Shorts: avgViews,
          contactEmail: d.contactEmail,
          alreadyRegistered: existingIds.has(d.youtubeChannelId),
          suggestedCategories,
        };
      }),
    );

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
