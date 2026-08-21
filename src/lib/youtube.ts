// YouTube Data API v3 연동 (스펙 6절 참고)
// - search.list: 키워드로 채널 후보 검색 (100 유니트)
// - channels.list: 구독자 수 등 채널 상세 정보 (1 유니트)
// - playlistItems.list / videos.list: 최근 업로드 영상의 조회수 · 길이 조회 (각 1 유니트)

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const SHORTS_MAX_DURATION_SECONDS = 60;
const RECENT_UPLOADS_TO_SCAN = 20;
const SHORTS_SAMPLE_SIZE = 6;

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error("YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return key;
}

async function youtubeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API 요청 실패 (${path}): ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

// ISO 8601 duration(예: PT1M3S) -> 초
export function parseIsoDurationToSeconds(duration: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function extractEmail(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = EMAIL_REGEX.exec(description);
  return match ? match[0] : null;
}

export function channelUrlFromHandleOrId(customUrl: string | undefined, channelId: string): string {
  if (customUrl) {
    return `https://www.youtube.com/${customUrl.startsWith("@") ? customUrl : `@${customUrl}`}`;
  }
  return `https://www.youtube.com/channel/${channelId}`;
}

type YoutubeSearchResponse = {
  items: { id: { channelId: string } }[];
};

// 키워드로 채널 후보를 검색해 channelId 목록을 반환한다.
export async function searchChannelIds(query: string, maxResults = 15): Promise<string[]> {
  const data = await youtubeFetch<YoutubeSearchResponse>("search", {
    part: "snippet",
    type: "channel",
    q: query,
    maxResults: String(maxResults),
  });
  return data.items.map((item) => item.id.channelId);
}

type YoutubeChannelsResponse = {
  items: {
    id: string;
    snippet: { title: string; description: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
    statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
    contentDetails: { relatedPlaylists: { uploads: string } };
  }[];
};

export type ChannelDetails = {
  youtubeChannelId: string;
  channelName: string;
  channelUrl: string;
  thumbnailUrl: string | null;
  description: string;
  subscriberCount: number;
  contactEmail: string | null;
  uploadsPlaylistId: string;
};

// channels.list 는 한 번에 최대 50개 id까지 조회 가능.
export async function fetchChannelDetails(channelIds: string[]): Promise<ChannelDetails[]> {
  if (channelIds.length === 0) return [];
  const details: ChannelDetails[] = [];

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await youtubeFetch<YoutubeChannelsResponse>("channels", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    });

    for (const item of data.items) {
      details.push({
        youtubeChannelId: item.id,
        channelName: item.snippet.title,
        channelUrl: channelUrlFromHandleOrId(item.snippet.customUrl, item.id),
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
        description: item.snippet.description,
        subscriberCount: item.statistics.hiddenSubscriberCount
          ? 0
          : Number(item.statistics.subscriberCount ?? 0),
        contactEmail: extractEmail(item.snippet.description),
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      });
    }
  }

  return details;
}

type YoutubePlaylistItemsResponse = {
  items: { contentDetails: { videoId: string } }[];
};

async function fetchRecentVideoIds(uploadsPlaylistId: string): Promise<string[]> {
  const data = await youtubeFetch<YoutubePlaylistItemsResponse>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(RECENT_UPLOADS_TO_SCAN),
  });
  return data.items.map((item) => item.contentDetails.videoId);
}

type YoutubeVideosResponse = {
  items: { id: string; statistics: { viewCount?: string }; contentDetails: { duration: string } }[];
};

async function fetchVideoStats(
  videoIds: string[],
): Promise<{ id: string; viewCount: number; durationSeconds: number }[]> {
  if (videoIds.length === 0) return [];
  const data = await youtubeFetch<YoutubeVideosResponse>("videos", {
    part: "statistics,contentDetails",
    id: videoIds.join(","),
  });
  return data.items.map((item) => ({
    id: item.id,
    viewCount: Number(item.statistics.viewCount ?? 0),
    durationSeconds: parseIsoDurationToSeconds(item.contentDetails.duration),
  }));
}

// 최근 업로드 영상 중 60초 이하(숏폼)만 필터링해 가장 최근 6개의 평균 조회수를 계산한다.
// (3.2 "최근 업로드 6개 영상 평균 조회수(숏폼 기준)")
export async function computeAvgViewsOfRecentShorts(
  uploadsPlaylistId: string,
): Promise<{ avgViews: number | null; sampleSize: number }> {
  const recentVideoIds = await fetchRecentVideoIds(uploadsPlaylistId);
  const stats = await fetchVideoStats(recentVideoIds);

  // playlistItems는 업로드 최신순으로 반환되므로 순서를 유지한 채 필터링한다.
  const shorts = stats
    .filter((v) => v.durationSeconds > 0 && v.durationSeconds <= SHORTS_MAX_DURATION_SECONDS)
    .slice(0, SHORTS_SAMPLE_SIZE);

  if (shorts.length === 0) return { avgViews: null, sampleSize: 0 };

  const total = shorts.reduce((sum, v) => sum + v.viewCount, 0);
  return { avgViews: Math.round(total / shorts.length), sampleSize: shorts.length };
}
