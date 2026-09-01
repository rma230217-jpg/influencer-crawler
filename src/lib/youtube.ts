// YouTube Data API v3 연동 (스펙 6절 참고)
// - search.list: 키워드로 채널 후보 검색 (100 유니트)
// - channels.list: 구독자 수 등 채널 상세 정보 (1 유니트)
// - playlistItems.list / videos.list: 최근 업로드 영상의 조회수 · 길이 조회 (각 1 유니트)

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const SHORTS_MAX_DURATION_SECONDS = 60;
const RECENT_UPLOADS_TO_SCAN = 20;
const SHORTS_SAMPLE_SIZE = 6;
// 검색 결과 한 페이지당 상세 조회(구독자/조회수/연락처)를 돌릴 채널 수.
// 값이 클수록 한 번에 더 많이 보이지만, 채널마다 API 호출이 2번씩 추가로 붙어 응답이 느려진다.
// "더 보기"로 계속 이어서 불러올 수 있으므로 작게 잡아 첫 응답 속도를 우선한다.
const SEARCH_PAGE_SIZE = 15;

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

// 한국 전화번호(휴대폰/지역번호) 형태를 소개란에서 찾는다. 공개적으로 적혀있는 경우만 수집.
const PHONE_REGEX = /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/;

export function extractPhone(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = PHONE_REGEX.exec(description);
  return match ? match[0] : null;
}

const INSTAGRAM_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i;
const INSTAGRAM_HANDLE_LINE_REGEX = /(?:instagram|insta|인스타)[^\n]*?@([a-zA-Z0-9_.]+)/i;

export function extractInstagram(description: string | null | undefined): string | null {
  if (!description) return null;

  const urlMatch = INSTAGRAM_URL_REGEX.exec(description);
  if (urlMatch) return `https://www.instagram.com/${urlMatch[1]}`;

  const handleMatch = INSTAGRAM_HANDLE_LINE_REGEX.exec(description);
  if (handleMatch) return `https://www.instagram.com/${handleMatch[1]}`;

  return null;
}

export function channelUrlFromHandleOrId(customUrl: string | undefined, channelId: string): string {
  if (customUrl) {
    return `https://www.youtube.com/${customUrl.startsWith("@") ? customUrl : `@${customUrl}`}`;
  }
  return `https://www.youtube.com/channel/${channelId}`;
}

type YoutubeSearchResponse = {
  items: { id: { channelId: string } }[];
  nextPageToken?: string;
};

// 키워드로 채널 후보를 검색해 channelId 목록을 반환한다.
// 한 페이지 크기는 SEARCH_PAGE_SIZE로 제한해 응답 속도를 확보하고,
// "더 보기"로 nextPageToken을 이어가며 사실상 개수 제한 없이 계속 불러올 수 있게 한다.
export async function searchChannelIds(
  query: string,
  pageToken?: string,
): Promise<{ channelIds: string[]; nextPageToken: string | null }> {
  const data = await youtubeFetch<YoutubeSearchResponse>("search", {
    part: "snippet",
    type: "channel",
    q: query,
    maxResults: String(SEARCH_PAGE_SIZE),
    ...(pageToken ? { pageToken } : {}),
  });
  return {
    channelIds: data.items.map((item) => item.id.channelId),
    nextPageToken: data.nextPageToken ?? null,
  };
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
  contactPhone: string | null;
  contactInstagram: string | null;
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
        contactPhone: extractPhone(item.snippet.description),
        contactInstagram: extractInstagram(item.snippet.description),
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
  items: {
    id: string;
    snippet: { title: string; publishedAt: string };
    statistics: { viewCount?: string };
    contentDetails: { duration: string };
  }[];
};

async function fetchVideoStats(
  videoIds: string[],
): Promise<
  { id: string; title: string; publishedAt: string; viewCount: number; durationSeconds: number }[]
> {
  if (videoIds.length === 0) return [];
  const data = await youtubeFetch<YoutubeVideosResponse>("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
  });
  return data.items.map((item) => ({
    id: item.id,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    viewCount: Number(item.statistics.viewCount ?? 0),
    durationSeconds: parseIsoDurationToSeconds(item.contentDetails.duration),
  }));
}

// 최근 업로드 영상 중 60초 이하(숏폼)만 필터링해 가장 최근 6개의 평균 조회수를 계산한다.
// (3.2 "최근 업로드 6개 영상 평균 조회수(숏폼 기준)")
// 카테고리 자동분류(제목)와 업로드 날짜 필터(최근 업로드일)에 쓸 수 있도록 함께 반환한다.
export async function computeAvgViewsOfRecentShorts(uploadsPlaylistId: string): Promise<{
  avgViews: number | null;
  sampleSize: number;
  recentTitles: string[];
  latestUploadDate: string | null;
}> {
  const recentVideoIds = await fetchRecentVideoIds(uploadsPlaylistId);
  const stats = await fetchVideoStats(recentVideoIds);
  const recentTitles = stats.map((v) => v.title);
  // playlistItems는 업로드 최신순으로 반환되므로 맨 앞이 가장 최근 업로드다.
  const latestUploadDate = stats[0]?.publishedAt ?? null;

  const shorts = stats
    .filter((v) => v.durationSeconds > 0 && v.durationSeconds <= SHORTS_MAX_DURATION_SECONDS)
    .slice(0, SHORTS_SAMPLE_SIZE);

  if (shorts.length === 0) return { avgViews: null, sampleSize: 0, recentTitles, latestUploadDate };

  const total = shorts.reduce((sum, v) => sum + v.viewCount, 0);
  return {
    avgViews: Math.round(total / shorts.length),
    sampleSize: shorts.length,
    recentTitles,
    latestUploadDate,
  };
}
