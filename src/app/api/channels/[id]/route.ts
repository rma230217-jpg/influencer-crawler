import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category } from "@/lib/types";

function isValidCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

type PatchBody = {
  categories?: Category[];
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_instagram?: string | null;
};

// 채널 카테고리 / 연락처 수정 (자동분류·자동추출이 틀렸거나 비어있을 때 수동 보정용)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  if (body.categories !== undefined) {
    if (!body.categories.every(isValidCategory)) {
      return NextResponse.json({ error: "유효하지 않은 카테고리입니다." }, { status: 400 });
    }

    const { error: deleteError } = await supabase.from("channel_categories").delete().eq("channel_id", id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (body.categories.length > 0) {
      const { error: insertError } = await supabase
        .from("channel_categories")
        .insert(body.categories.map((category) => ({ channel_id: id, category })));
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }

  const contactUpdate: Record<string, string | null> = {};
  if (body.contact_email !== undefined) contactUpdate.contact_email = body.contact_email;
  if (body.contact_phone !== undefined) contactUpdate.contact_phone = body.contact_phone;
  if (body.contact_instagram !== undefined) contactUpdate.contact_instagram = body.contact_instagram;

  if (Object.keys(contactUpdate).length > 0) {
    const { error: updateError } = await supabase.from("channels").update(contactUpdate).eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

// 채널 삭제
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
