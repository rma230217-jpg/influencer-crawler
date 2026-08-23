export const CATEGORIES = [
  "뷰티",
  "패션",
  "푸드",
  "리빙/홈",
  "육아",
  "반려동물",
  "살림",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Channel = {
  id: string;
  platform: string;
  youtube_channel_id: string | null;
  channel_name: string;
  channel_url: string;
  description: string | null;
  subscriber_count: number;
  avg_views_last_6_shorts: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_instagram: string | null;
  last_updated_at: string;
  created_at: string;
  categories: Category[];
  is_saved: boolean;
};

export type ChannelCandidate = {
  youtubeChannelId: string;
  channelName: string;
  channelUrl: string;
  thumbnailUrl: string | null;
  description: string;
  subscriberCount: number;
  avgViewsLast6Shorts: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactInstagram: string | null;
  alreadyRegistered: boolean;
  suggestedCategories: Category[];
};

export type SortKey = "subscriber_count" | "avg_views_last_6_shorts";
export type SortDirection = "asc" | "desc";

export type ChannelList = {
  id: string;
  name: string;
  channel_count: number;
  created_at: string;
};
