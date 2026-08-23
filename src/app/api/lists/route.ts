import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ChannelList } from "@/lib/types";

type ListRow = {
  id: string;
  name: string;
  created_at: string;
  list_channels: { count: number }[];
};

// 목록(리스트) 전체 조회 (채널 개수 포함) — 팀 전체 공유
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("lists")
    .select("id, name, created_at, list_channels(count)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lists: ChannelList[] = (data as ListRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    channel_count: row.list_channels[0]?.count ?? 0,
  }));

  return NextResponse.json({ lists });
}

// 새 목록 생성
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "목록 이름을 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lists")
    .insert({ name, created_by: user.id })
    .select("id, name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 있는 목록 이름입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ list: { ...data, channel_count: 0 } }, { status: 201 });
}
