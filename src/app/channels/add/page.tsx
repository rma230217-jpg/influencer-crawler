"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category, type ChannelCandidate } from "@/lib/types";

export default function AddChannelPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ChannelCandidate[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [categoriesByChannel, setCategoriesByChannel] = useState<Record<string, Category[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearchError(null);
    setCandidates([]);
    setSelected({});

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
      const fetchedCandidates: ChannelCandidate[] = data.candidates;
      setCandidates(fetchedCandidates);
      // 채널명/소개란/최근 업로드 제목 기반 자동 분류 결과를 기본값으로 채워둔다.
      setCategoriesByChannel(
        Object.fromEntries(fetchedCandidates.map((c) => [c.youtubeChannelId, c.suggestedCategories])),
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleCategory(id: string, category: Category) {
    setCategoriesByChannel((prev) => {
      const current = prev[id] ?? [];
      const next = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      return { ...prev, [id]: next };
    });
  }

  async function handleRegister() {
    const selectedIds = Object.keys(selected).filter((id) => selected[id]);
    if (selectedIds.length === 0) {
      setSubmitError("등록할 채널을 하나 이상 선택하세요.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: selectedIds.map((id) => ({
            youtubeChannelId: id,
            categories: categoriesByChannel[id],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록에 실패했습니다.");

      router.push("/");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← 대시보드로
          </Link>
          <h1 className="text-base font-semibold text-neutral-900">신규 채널 추가</h1>
          <div />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색 키워드 (예: 육아 브이로그)"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "검색 중..." : "검색"}
          </button>
        </form>

        {searchError && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</p>
        )}

        {loading && <p className="text-sm text-neutral-500">채널 정보를 수집하는 중입니다 (조회수 계산 포함, 시간이 걸릴 수 있어요)...</p>}

        {!loading && candidates.length > 0 && (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div
                key={c.youtubeChannelId}
                className={`rounded-lg border bg-white p-4 ${
                  c.alreadyRegistered ? "border-neutral-200 opacity-60" : "border-neutral-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    disabled={c.alreadyRegistered}
                    checked={!!selected[c.youtubeChannelId]}
                    onChange={() => toggleSelected(c.youtubeChannelId)}
                    className="mt-1.5"
                  />
                  {c.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnailUrl} alt="" className="h-12 w-12 rounded-full" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={c.channelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-neutral-900 hover:underline"
                      >
                        {c.channelName}
                      </a>
                      {c.alreadyRegistered && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                          이미 등록됨
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      구독자 {c.subscriberCount.toLocaleString("ko-KR")}명 · 최근 숏폼 평균 조회수{" "}
                      {c.avgViewsLast6Shorts?.toLocaleString("ko-KR") ?? "숏폼 없음"}
                      {c.contactEmail ? ` · ${c.contactEmail}` : ""}
                      {c.contactPhone ? ` · ${c.contactPhone}` : ""}
                      {c.contactInstagram ? ` · IG` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{c.description}</p>

                    <p className="mt-2 text-xs text-neutral-400">
                      자동 분류된 카테고리입니다. 틀렸다면 클릭해서 수정하세요.
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {CATEGORIES.map((cat) => {
                        const active = categoriesByChannel[c.youtubeChannelId]?.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => toggleCategory(c.youtubeChannelId, cat)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              active
                                ? "bg-neutral-900 text-white"
                                : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                      {!categoriesByChannel[c.youtubeChannelId]?.length && (
                        <span className="px-1 py-1 text-xs text-neutral-400">(분류 안 됨 — 직접 선택 가능)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <button
              onClick={handleRegister}
              disabled={submitting}
              className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "선택한 채널 등록"}
            </button>
          </div>
        )}

        {!loading && candidates.length === 0 && !searchError && (
          <p className="text-sm text-neutral-400">키워드로 유튜브 채널을 검색해 등록할 후보를 찾아보세요.</p>
        )}
      </main>
    </div>
  );
}
