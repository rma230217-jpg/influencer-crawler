"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChannelList } from "@/lib/types";

// 9.4 목록 관리: 채널을 이름 붙여 분류하는 목록 생성/조회
export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<ChannelList[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lists")
      .then((res) => res.json())
      .then((data) => setLists(data.lists ?? []));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError(null);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      setError(data.error ?? "목록 생성에 실패했습니다.");
      return;
    }

    setName("");
    router.push(`/lists/${data.list.id}`);
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← 대시보드로
          </Link>
          <h1 className="text-base font-semibold text-neutral-900">목록</h1>
          <div />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <form onSubmit={handleCreate} className="mb-6 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="새 목록 이름 (예: 8월 공동구매 후보)"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {creating ? "생성 중..." : "목록 만들기"}
          </button>
        </form>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {lists === null ? (
          <p className="text-sm text-neutral-400">불러오는 중...</p>
        ) : lists.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 만든 목록이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-300 hover:bg-neutral-50"
              >
                <span className="font-medium text-neutral-900">{list.name}</span>
                <span className="text-sm text-neutral-500">{list.channel_count}개 채널</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
