import type { Category, Channel } from "@/lib/types";

export type ChannelRow = {
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
  channel_categories: { category: Category }[];
  // saved_channels.channel_id가 PK(고유)라서 PostgREST가 1:1 관계로 추론해
  // 배열이 아니라 단일 객체 또는 null로 내려줄 수 있다 (버전/쿼리에 따라 배열로 오기도 함).
  saved_channels: { channel_id: string }[] | { channel_id: string } | null;
};

export const CHANNEL_SELECT =
  "id, platform, youtube_channel_id, channel_name, channel_url, description, subscriber_count, avg_views_last_6_shorts, contact_email, contact_phone, contact_instagram, last_updated_at, created_at, channel_categories(category), saved_channels(channel_id)";

export function mapChannelRow(row: ChannelRow): Channel {
  const isSaved = Array.isArray(row.saved_channels)
    ? row.saved_channels.length > 0
    : row.saved_channels != null;

  return {
    id: row.id,
    platform: row.platform,
    youtube_channel_id: row.youtube_channel_id,
    channel_name: row.channel_name,
    channel_url: row.channel_url,
    description: row.description,
    subscriber_count: row.subscriber_count,
    avg_views_last_6_shorts: row.avg_views_last_6_shorts,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    contact_instagram: row.contact_instagram,
    last_updated_at: row.last_updated_at,
    created_at: row.created_at,
    categories: (row.channel_categories ?? []).map((c) => c.category),
    is_saved: isSaved,
  };
}
