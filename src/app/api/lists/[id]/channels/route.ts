import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 목록에 채널 추가
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { channelId?: string } | null;
  if (!body?.channelId) {
    return NextResponse.json({ error: "channelId가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("list_channels")
    .upsert(
      { list_id: id, channel_id: body.channelId, added_by: user.id },
      { onConflict: "list_id,channel_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
