import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 목록에서 채널 제거
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> },
) {
  const { id, channelId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { error } = await supabase
    .from("list_channels")
    .delete()
    .eq("list_id", id)
    .eq("channel_id", channelId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
