"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  type Category,
  type Channel,
  type ChannelCandidate,
  type ChannelList,
  type SortDirection,
  type SortKey,
} from "@/lib/types";
import { CategoryBadge } from "@/components/CategoryBadge";

function formatNumber(n: number | null) {
  if (n === null) return "-";
  return n.toLocaleString("ko-KR");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadChannelsCsv(channels: Channel[]) {
  const header = ["계정명", "채널 URL", "구독자수", "평균조회수", "카테고리", "이메일", "전화번호", "인스타그램 링크"];
  const rows = channels.map((c) => [
    c.channel_name,
    c.channel_url,
    String(c.subscriber_count),
    c.avg_views_last_6_shorts !== null ? String(c.avg_views_last_6_shorts) : "",
    c.categories.join(" "),
    c.contact_email ?? "",
    c.contact_phone ?? "",
    c.contact_instagram ?? "",
  ]);

  // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.
  const csv = "﻿" + [header, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `influencer-channels-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Dashboard({
  initialChannels,
  variant = "all",
  listId,
}: {
  initialChannels: Channel[];
  variant?: "all" | "saved" | "list";
  listId?: string;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [removingFromListId, setRemovingFromListId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | "전체">("전체");
  const [sortKey, setSortKey] = useState<SortKey>("avg_views_last_6_shorts");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<"card" | "table">("table");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [contactChannelId, setContactChannelId] = useState<string | null>(null);

  // 9.1 메인 검색: 키워드/채널/주제로 유튜브에서 실시간으로 활동 중인 계정을 찾는다.
  const [ytQuery, setYtQuery] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytLoadingMore, setYtLoadingMore] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<ChannelCandidate[] | null>(null);
  const [ytNextPageToken, setYtNextPageToken] = useState<string | null>(null);
  const [ytCategoriesByChannel, setYtCategoriesByChannel] = useState<Record<string, Category[]>>({});
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});

  // 검색 결과 필터: 조회수 범위 / 구독자 범위 / 최근 업로드 날짜 범위
  const [minViews, setMinViews] = useState("");
  const [maxViews, setMaxViews] = useState("");
  const [minSubs, setMinSubs] = useState("");
  const [maxSubs, setMaxSubs] = useState("");
  const [uploadFrom, setUploadFrom] = useState("");
  const [uploadTo, setUploadTo] = useState("");

  // 채널 등록 시 목록(리스트) 선택 팝업
  const [pickingCandidate, setPickingCandidate] = useState<ChannelCandidate | null>(null);
  const [availableLists, setAvailableLists] = useState<ChannelList[] | null>(null);
  const [registering, setRegistering] = useState(false);

  const filtered = useMemo(() => {
    let list = channels;

    if (activeCategory !== "전체") {
      list = list.filter((c) => c.categories.includes(activeCategory));
    }

    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return sortDirection === "desc" ? bv - av : av - bv;
    });
  }, [channels, activeCategory, sortKey, sortDirection]);

  const hasYtFilters = Boolean(minViews || maxViews || minSubs || maxSubs || uploadFrom || uploadTo);

  const filteredYtResults = useMemo(() => {
    if (!ytResults) return null;
    if (!hasYtFilters) return ytResults;

    const minV = minViews ? Number(minViews) : null;
    const maxV = maxViews ? Number(maxViews) : null;
    const minS = minSubs ? Number(minSubs) : null;
    const maxS = maxSubs ? Number(maxSubs) : null;
    const fromDate = uploadFrom ? new Date(uploadFrom) : null;
    // "까지" 날짜는 그날 끝까지 포함되도록 다음날 자정 직전으로 계산한다.
    const toDate = uploadTo ? new Date(new Date(uploadTo).getTime() + 24 * 60 * 60 * 1000) : null;

    return ytResults.filter((c) => {
      if ((minV !== null || maxV !== null) && c.avgViewsLast6Shorts === null) return false;
      if (minV !== null && (c.avgViewsLast6Shorts ?? 0) < minV) return false;
      if (maxV !== null && (c.avgViewsLast6Shorts ?? 0) > maxV) return false;

      if (minS !== null && c.subscriberCount < minS) return false;
      if (maxS !== null && c.subscriberCount > maxS) return false;

      if ((fromDate || toDate) && !c.latestUploadDate) return false;
      if (c.latestUploadDate) {
        const uploaded = new Date(c.latestUploadDate);
        if (fromDate && uploaded < fromDate) return false;
        if (toDate && uploaded >= toDate) return false;
      }

      return true;
    });
  }, [ytResults, hasYtFilters, minViews, maxViews, minSubs, maxSubs, uploadFrom, uploadTo]);

  function resetYtFilters() {
    setMinViews("");
    setMaxViews("");
    setMinSubs("");
    setMaxSubs("");
    setUploadFrom("");
    setUploadTo("");
  }

  const contactChannel = channels.find((c) => c.id === contactChannelId) ?? null;

  async function refreshChannels() {
    const res = await fetch("/api/channels");
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
    }
  }

  // 9.1: pageToken이 있으면 다음 페이지를 이어붙이고("더 보기"), 없으면 새 검색으로 초기화한다.
  async function runYoutubeSearch(query: string, pageToken?: string) {
    if (!query.trim()) return;

    if (pageToken) setYtLoadingMore(true);
    else {
      setYtLoading(true);
      setYtResults(null);
    }
    setYtError(null);

    try {
      const url = `/api/youtube/search?q=${encodeURIComponent(query.trim())}${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
      const results: ChannelCandidate[] = data.candidates;
      setYtResults((prev) => (pageToken && prev ? [...prev, ...results] : results));
      setYtCategoriesByChannel((prev) => ({
        ...(pageToken ? prev : {}),
        ...Object.fromEntries(results.map((c) => [c.youtubeChannelId, c.suggestedCategories])),
      }));
      setYtNextPageToken(data.nextPageToken ?? null);
    } catch (err) {
      setYtError(err instanceof Error ? err.message : "검색에 실패했습니다.");
    } finally {
      setYtLoading(false);
      setYtLoadingMore(false);
    }
  }

  function handleYoutubeSearch(e: React.FormEvent) {
    e.preventDefault();
    runYoutubeSearch(ytQuery);
  }

  function handleLoadMore() {
    if (ytNextPageToken) runYoutubeSearch(ytQuery, ytNextPageToken);
  }

  function toggleYtCategory(id: string, category: Category) {
    setYtCategoriesByChannel((prev) => {
      const current = prev[id] ?? [];
      const next = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      return { ...prev, [id]: next };
    });
  }

  // 4. 채널 등록 버튼 -> 어느 목록에 넣을지 고르는 팝업을 띄운다.
  async function openListPicker(candidate: ChannelCandidate) {
    setPickingCandidate(candidate);
    setRegisterErrors((prev) => ({ ...prev, [candidate.youtubeChannelId]: "" }));
    if (availableLists === null) {
      const res = await fetch("/api/lists");
      if (res.ok) {
        const data = await res.json();
        setAvailableLists(data.lists ?? []);
      } else {
        setAvailableLists([]);
      }
    }
  }

  async function createList(name: string): Promise<ChannelList | null> {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "목록 생성에 실패했습니다.");
      return null;
    }
    setAvailableLists((prev) => [data.list, ...(prev ?? [])]);
    return data.list;
  }

  // 채널 등록(+ 선택한 목록에 추가). listId가 없으면 목록 없이 등록만 한다.
  async function finalizeRegistration(candidate: ChannelCandidate, listId: string | null) {
    setRegistering(true);
    setRegisterErrors((prev) => ({ ...prev, [candidate.youtubeChannelId]: "" }));

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: [
            {
              youtubeChannelId: candidate.youtubeChannelId,
              categories: ytCategoriesByChannel[candidate.youtubeChannelId] ?? [],
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록에 실패했습니다.");

      const insertedId: string | undefined = data.inserted?.[0]?.id;
      if (listId && insertedId) {
        const listRes = await fetch(`/api/lists/${listId}/channels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: insertedId }),
        });
        if (!listRes.ok) {
          const listData = await listRes.json().catch(() => ({}));
          throw new Error(listData.error ?? "목록에 추가하는 데 실패했습니다 (채널 등록은 완료됐어요).");
        }
        setAvailableLists(
          (prev) =>
            prev?.map((l) => (l.id === listId ? { ...l, channel_count: l.channel_count + 1 } : l)) ?? prev,
        );
      }

      setYtResults(
        (prev) =>
          prev?.map((c) =>
            c.youtubeChannelId === candidate.youtubeChannelId ? { ...c, alreadyRegistered: true } : c,
          ) ?? null,
      );
      await refreshChannels();
      setPickingCandidate(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "등록에 실패했습니다.";
      setRegisterErrors((prev) => ({ ...prev, [candidate.youtubeChannelId]: message }));
    } finally {
      setRegistering(false);
    }
  }

  function startEditingCategories(channel: Channel) {
    setEditingId(channel.id);
    setEditCategories(channel.categories);
  }

  function toggleEditCategory(category: Category) {
    setEditCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }

  async function saveCategories(id: string) {
    setSavingCategories(true);
    const res = await fetch(`/api/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: editCategories }),
    });
    setSavingCategories(false);
    if (res.ok) {
      setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, categories: editCategories } : c)));
      setEditingId(null);
    } else {
      alert("카테고리 저장에 실패했습니다.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 채널을 목록에서 삭제할까요?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } else {
      alert("삭제에 실패했습니다.");
    }
  }

  // 4. 목록(리스트) 상세 화면에서 채널을 그 목록에서만 빼기
  async function removeFromList(channelId: string) {
    if (!listId) return;
    setRemovingFromListId(channelId);
    const res = await fetch(`/api/lists/${listId}/channels/${channelId}`, { method: "DELETE" });
    setRemovingFromListId(null);
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
    } else {
      alert("목록에서 제거하는 데 실패했습니다.");
    }
  }

  // 9.5 저장 목록(즐겨찾기, 팀 전체 공유) 토글
  async function toggleSaved(channel: Channel) {
    setSavingId(channel.id);
    const res = await fetch(`/api/channels/${channel.id}/saved`, {
      method: channel.is_saved ? "DELETE" : "POST",
    });
    setSavingId(null);
    if (!res.ok) {
      alert("저장 목록 변경에 실패했습니다.");
      return;
    }
    if (variant === "saved" && channel.is_saved) {
      // 저장 목록 페이지에서 해제하면 목록에서 바로 사라진다.
      setChannels((prev) => prev.filter((c) => c.id !== channel.id));
    } else {
      setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, is_saved: !c.is_saved } : c)));
    }
  }

  async function saveContactField(id: string, field: "contact_email" | "contact_phone" | "contact_instagram", value: string) {
    const trimmed = value.trim();
    const res = await fetch(`/api/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: trimmed || null }),
    });
    if (res.ok) {
      setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: trimmed || null } : c)));
    } else {
      alert("연락처 저장에 실패했습니다.");
    }
  }

  return (
    <div>
      {/* 9.1 메인 검색: 키워드/채널/주제를 입력하면 유튜브에서 실시간으로 활동 중인 계정을 찾아온다. */}
      <form onSubmit={handleYoutubeSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={ytQuery}
          onChange={(e) => setYtQuery(e.target.value)}
          placeholder="키워드 / 채널명 / 주제로 유튜브에서 활동 중인 계정 검색 (예: 육아 브이로그)"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={ytLoading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {ytLoading ? "검색 중..." : "검색"}
        </button>
        {ytResults && (
          <button
            type="button"
            onClick={() => {
              setYtResults(null);
              setYtQuery("");
              resetYtFilters();
            }}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            검색결과 지우기
          </button>
        )}
      </form>

      {ytError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{ytError}</p>
      )}
      {ytLoading && (
        <p className="mb-4 text-sm text-neutral-500">
          유튜브에서 활동 중인 계정을 찾는 중입니다 (조회수 계산 포함, 시간이 걸릴 수 있어요)...
        </p>
      )}
      {ytResults && !ytLoading && (
        <div className="mb-6 space-y-3">
          <YtResultFilters
            minViews={minViews}
            maxViews={maxViews}
            minSubs={minSubs}
            maxSubs={maxSubs}
            uploadFrom={uploadFrom}
            uploadTo={uploadTo}
            onChange={{
              setMinViews,
              setMaxViews,
              setMinSubs,
              setMaxSubs,
              setUploadFrom,
              setUploadTo,
            }}
            onReset={resetYtFilters}
            hasFilters={hasYtFilters}
          />

          <p className="text-sm text-neutral-500">
            &quot;{ytQuery}&quot; 검색 결과 {filteredYtResults?.length ?? 0}개 계정
            {hasYtFilters && ` (전체 ${ytResults.length}개 중 필터링됨)`}
          </p>
          {filteredYtResults?.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
              {hasYtFilters ? "필터 조건에 맞는 계정이 없습니다." : "활동 중인 계정을 찾지 못했습니다."}
            </div>
          ) : (
            <>
              {filteredYtResults?.map((c) => (
                <YoutubeCandidateRow
                  key={c.youtubeChannelId}
                  candidate={c}
                  selectedCategories={ytCategoriesByChannel[c.youtubeChannelId] ?? []}
                  onToggleCategory={(cat) => toggleYtCategory(c.youtubeChannelId, cat)}
                  onRegister={() => openListPicker(c)}
                  error={registerErrors[c.youtubeChannelId]}
                />
              ))}
              {ytNextPageToken && (
                <button
                  onClick={handleLoadMore}
                  disabled={ytLoadingMore}
                  className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  {ytLoadingMore ? "불러오는 중..." : "더 보기"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {pickingCandidate && (
        <ListPickerModal
          candidateName={pickingCandidate.channelName}
          lists={availableLists}
          registering={registering}
          onPickList={(listId) => finalizeRegistration(pickingCandidate, listId)}
          onSkip={() => finalizeRegistration(pickingCandidate, null)}
          onCreateList={createList}
          onClose={() => setPickingCandidate(null)}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {(["전체", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                activeCategory === cat
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={() => downloadChannelsCsv(filtered)}
          disabled={filtered.length === 0}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          엑셀 다운로드
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
        >
          <option value="avg_views_last_6_shorts">평균 조회수</option>
          <option value="subscriber_count">구독자 수</option>
        </select>

        <select
          value={sortDirection}
          onChange={(e) => setSortDirection(e.target.value as SortDirection)}
          className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
        >
          <option value="desc">높은순</option>
          <option value="asc">낮은순</option>
        </select>

        <div className="ml-auto flex overflow-hidden rounded-md border border-neutral-300 text-sm">
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 ${view === "table" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600"}`}
          >
            테이블
          </button>
          <button
            onClick={() => setView("card")}
            className={`px-3 py-1.5 ${view === "card" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600"}`}
          >
            카드
          </button>
        </div>
      </div>

      <p className="mb-3 text-sm text-neutral-500">{filtered.length}개 채널</p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-16 text-center text-sm text-neutral-500">
          {variant === "saved"
            ? "저장된 채널이 없습니다."
            : variant === "list"
              ? "이 목록에 채널이 없습니다."
              : "조건에 맞는 채널이 없습니다."}
        </div>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium" />
                <th className="px-4 py-2 font-medium">채널명</th>
                <th className="px-4 py-2 font-medium">구독자 수</th>
                <th className="px-4 py-2 font-medium">평균 조회수</th>
                <th className="px-4 py-2 font-medium">카테고리</th>
                <th className="px-4 py-2 font-medium">최종 업데이트</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleSaved(c)}
                      disabled={savingId === c.id}
                      title={c.is_saved ? "저장 목록에서 제거" : "저장 목록에 추가"}
                      className={`text-lg leading-none ${c.is_saved ? "text-amber-500" : "text-neutral-300 hover:text-neutral-500"}`}
                    >
                      {c.is_saved ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={c.channel_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {c.channel_name}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">{formatNumber(c.subscriber_count)}</td>
                  <td className="px-4 py-2 text-neutral-700">{formatNumber(c.avg_views_last_6_shorts)}</td>
                  <td className="px-4 py-2">
                    {editingId === c.id ? (
                      <CategoryEditor
                        selected={editCategories}
                        onToggle={toggleEditCategory}
                        onSave={() => saveCategories(c.id)}
                        onCancel={() => setEditingId(null)}
                        saving={savingCategories}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {c.categories.map((cat) => (
                          <CategoryBadge key={cat} category={cat} />
                        ))}
                        {c.categories.length === 0 && (
                          <span className="text-xs text-neutral-400">미분류</span>
                        )}
                        <button
                          onClick={() => startEditingCategories(c)}
                          className="ml-1 text-xs text-neutral-400 hover:text-neutral-700"
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{formatDate(c.last_updated_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setContactChannelId(c.id)}
                        className="text-xs font-medium text-neutral-700 hover:underline"
                      >
                        컨택하기
                      </button>
                      {variant === "list" && (
                        <button
                          onClick={() => removeFromList(c.id)}
                          disabled={removingFromListId === c.id}
                          className="text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                        >
                          목록에서 제거
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-2 flex items-start justify-between">
                <a
                  href={c.channel_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-neutral-900 hover:underline"
                >
                  {c.channel_name}
                </a>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSaved(c)}
                    disabled={savingId === c.id}
                    title={c.is_saved ? "저장 목록에서 제거" : "저장 목록에 추가"}
                    className={`text-lg leading-none ${c.is_saved ? "text-amber-500" : "text-neutral-300 hover:text-neutral-500"}`}
                  >
                    {c.is_saved ? "★" : "☆"}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="mb-2">
                {editingId === c.id ? (
                  <CategoryEditor
                    selected={editCategories}
                    onToggle={toggleEditCategory}
                    onSave={() => saveCategories(c.id)}
                    onCancel={() => setEditingId(null)}
                    saving={savingCategories}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-1">
                    {c.categories.map((cat) => (
                      <CategoryBadge key={cat} category={cat} />
                    ))}
                    {c.categories.length === 0 && <span className="text-xs text-neutral-400">미분류</span>}
                    <button
                      onClick={() => startEditingCategories(c)}
                      className="ml-1 text-xs text-neutral-400 hover:text-neutral-700"
                    >
                      수정
                    </button>
                  </div>
                )}
              </div>
              <dl className="space-y-1 text-sm text-neutral-600">
                <div className="flex justify-between">
                  <dt>구독자 수</dt>
                  <dd className="font-medium text-neutral-900">{formatNumber(c.subscriber_count)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>평균 조회수</dt>
                  <dd className="font-medium text-neutral-900">{formatNumber(c.avg_views_last_6_shorts)}</dd>
                </div>
              </dl>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-neutral-400">최종 업데이트 {formatDate(c.last_updated_at)}</p>
                <div className="flex items-center gap-3">
                  {variant === "list" && (
                    <button
                      onClick={() => removeFromList(c.id)}
                      disabled={removingFromListId === c.id}
                      className="text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                    >
                      목록에서 제거
                    </button>
                  )}
                  <button
                    onClick={() => setContactChannelId(c.id)}
                    className="text-xs font-medium text-neutral-700 hover:underline"
                  >
                    컨택하기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {contactChannel && (
        <ContactModal
          channel={contactChannel}
          onClose={() => setContactChannelId(null)}
          onSaveField={saveContactField}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  selected,
  onToggle,
  onSave,
  onCancel,
  saving,
}: {
  selected: Category[];
  onToggle: (category: Category) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="min-w-48">
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => {
          const active = selected.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggle(cat)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                active
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs font-medium text-neutral-900 hover:underline disabled:opacity-50"
        >
          저장
        </button>
        <button onClick={onCancel} className="text-xs text-neutral-400 hover:text-neutral-700">
          취소
        </button>
      </div>
    </div>
  );
}

// 9.3 컨택하기: 이메일/전화번호/인스타그램을 모아서 보여주고, 자동 추출이 비어있으면 수동으로 채울 수 있다.
function ContactModal({
  channel,
  onClose,
  onSaveField,
}: {
  channel: Channel;
  onClose: () => void;
  onSaveField: (id: string, field: "contact_email" | "contact_phone" | "contact_instagram", value: string) => void;
}) {
  const [email, setEmail] = useState(channel.contact_email ?? "");
  const [phone, setPhone] = useState(channel.contact_phone ?? "");
  const [instagram, setInstagram] = useState(channel.contact_instagram ?? "");

  const fields: {
    label: string;
    value: string;
    setValue: (v: string) => void;
    field: "contact_email" | "contact_phone" | "contact_instagram";
    placeholder: string;
  }[] = [
    { label: "이메일", value: email, setValue: setEmail, field: "contact_email", placeholder: "example@email.com" },
    { label: "전화번호", value: phone, setValue: setPhone, field: "contact_phone", placeholder: "010-0000-0000" },
    {
      label: "인스타그램",
      value: instagram,
      setValue: setInstagram,
      field: "contact_instagram",
      placeholder: "https://www.instagram.com/handle",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-base font-semibold text-neutral-900">{channel.channel_name} 컨택하기</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-neutral-400">
          공개된 정보를 자동으로 모았습니다. 비어있거나 틀린 정보는 직접 수정해서 저장할 수 있어요.
        </p>

        <div className="space-y-3">
          {fields.map(({ label, value, setValue, field, placeholder }) => (
            <div key={field}>
              <label className="mb-1 block text-xs font-medium text-neutral-500">{label}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                />
                <button
                  onClick={() => onSaveField(channel.id, field, value)}
                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100"
                >
                  저장
                </button>
              </div>
            </div>
          ))}
        </div>

        <a
          href={channel.channel_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block text-center text-xs text-neutral-400 hover:text-neutral-700"
        >
          유튜브 채널 바로가기
        </a>
      </div>
    </div>
  );
}

// 9.1 메인 검색 결과 한 줄: 유튜브에서 실시간으로 찾은 계정 + 바로 등록 가능한 버튼.
// 9.2 연락처(이메일/전화번호/인스타그램)를 바로 확인할 수 있도록 각각 따로 보여준다.
// 검색 결과 필터: 조회수 범위 / 구독자 범위 / 최근 업로드 날짜 범위
function YtResultFilters({
  minViews,
  maxViews,
  minSubs,
  maxSubs,
  uploadFrom,
  uploadTo,
  onChange,
  onReset,
  hasFilters,
}: {
  minViews: string;
  maxViews: string;
  minSubs: string;
  maxSubs: string;
  uploadFrom: string;
  uploadTo: string;
  onChange: {
    setMinViews: (v: string) => void;
    setMaxViews: (v: string) => void;
    setMinSubs: (v: string) => void;
    setMaxSubs: (v: string) => void;
    setUploadFrom: (v: string) => void;
    setUploadTo: (v: string) => void;
  };
  onReset: () => void;
  hasFilters: boolean;
}) {
  const numberInputClass =
    "w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
  const dateInputClass =
    "rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-white p-3">
      <div>
        <label className="mb-1 block text-xs text-neutral-500">조회수 범위</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            placeholder="최소"
            value={minViews}
            onChange={(e) => onChange.setMinViews(e.target.value)}
            className={numberInputClass}
          />
          <span className="text-neutral-400">~</span>
          <input
            type="number"
            min={0}
            placeholder="최대"
            value={maxViews}
            onChange={(e) => onChange.setMaxViews(e.target.value)}
            className={numberInputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-neutral-500">구독자 범위</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            placeholder="최소"
            value={minSubs}
            onChange={(e) => onChange.setMinSubs(e.target.value)}
            className={numberInputClass}
          />
          <span className="text-neutral-400">~</span>
          <input
            type="number"
            min={0}
            placeholder="최대"
            value={maxSubs}
            onChange={(e) => onChange.setMaxSubs(e.target.value)}
            className={numberInputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-neutral-500">영상 업로드 날짜 범위</label>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={uploadFrom}
            onChange={(e) => onChange.setUploadFrom(e.target.value)}
            className={dateInputClass}
          />
          <span className="text-neutral-400">~</span>
          <input
            type="date"
            value={uploadTo}
            onChange={(e) => onChange.setUploadTo(e.target.value)}
            className={dateInputClass}
          />
        </div>
      </div>

      {hasFilters && (
        <button onClick={onReset} className="text-xs text-neutral-500 hover:text-neutral-900">
          필터 초기화
        </button>
      )}
    </div>
  );
}

function YoutubeCandidateRow({
  candidate,
  selectedCategories,
  onToggleCategory,
  onRegister,
  error,
}: {
  candidate: ChannelCandidate;
  selectedCategories: Category[];
  onToggleCategory: (category: Category) => void;
  onRegister: () => void;
  error?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {candidate.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.thumbnailUrl} alt="" className="h-12 w-12 rounded-full" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <a
              href={candidate.channelUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-900 hover:underline"
            >
              {candidate.channelName}
            </a>
            {candidate.alreadyRegistered && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                이미 등록됨
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            구독자 {candidate.subscriberCount.toLocaleString("ko-KR")}명 · 최근 숏폼 평균 조회수{" "}
            {candidate.avgViewsLast6Shorts?.toLocaleString("ko-KR") ?? "숏폼 없음"} · 최근 업로드{" "}
            {candidate.latestUploadDate ? candidate.latestUploadDate.slice(0, 10) : "정보 없음"}
          </p>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500">
            <div className="flex gap-1">
              <dt className="text-neutral-400">이메일</dt>
              <dd>{candidate.contactEmail ?? "-"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-neutral-400">전화번호</dt>
              <dd>{candidate.contactPhone ?? "-"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-neutral-400">인스타그램</dt>
              <dd>
                {candidate.contactInstagram ? (
                  <a
                    href={candidate.contactInstagram}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-700 hover:underline"
                  >
                    {candidate.contactInstagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@")}
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{candidate.description}</p>

          {!candidate.alreadyRegistered && (
            <>
              <div className="mt-2 flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => {
                  const active = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => onToggleCategory(cat)}
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
              </div>
              {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
              <button
                onClick={onRegister}
                className="mt-2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                채널 등록
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 4. 채널 등록 시 목록 선택: 기존 목록은 클릭만으로 추가, 새 목록도 그 자리에서 만들 수 있다.
function ListPickerModal({
  candidateName,
  lists,
  registering,
  onPickList,
  onSkip,
  onCreateList,
  onClose,
}: {
  candidateName: string;
  lists: ChannelList[] | null;
  registering: boolean;
  onPickList: (listId: string) => void;
  onSkip: () => void;
  onCreateList: (name: string) => Promise<ChannelList | null>;
  onClose: () => void;
}) {
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateAndPick(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    setCreating(true);
    const list = await onCreateList(newListName.trim());
    setCreating(false);
    if (list) {
      setNewListName("");
      onPickList(list.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-base font-semibold text-neutral-900">{candidateName} 등록</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" disabled={registering}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-neutral-400">어느 목록에 추가할까요? 목록 없이 등록만 할 수도 있어요.</p>

        <form onSubmit={handleCreateAndPick} className="mb-4 flex gap-2">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="새 목록 이름"
            disabled={registering}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={creating || registering || !newListName.trim()}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {creating ? "생성 중..." : "만들고 등록"}
          </button>
        </form>

        {lists === null ? (
          <p className="text-sm text-neutral-400">목록을 불러오는 중...</p>
        ) : lists.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => onPickList(list.id)}
                disabled={registering}
                className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                {list.name} ({list.channel_count})
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-neutral-400">아직 만든 목록이 없습니다.</p>
        )}

        <button
          onClick={onSkip}
          disabled={registering}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
        >
          {registering ? "등록 중..." : "목록에 추가하지 않고 등록만"}
        </button>
      </div>
    </div>
  );
}
