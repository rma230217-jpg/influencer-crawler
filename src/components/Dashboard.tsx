"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  type Category,
  type Channel,
  type ChannelCandidate,
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
}: {
  initialChannels: Channel[];
  variant?: "all" | "saved";
}) {
  const [channels, setChannels] = useState(initialChannels);
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
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<ChannelCandidate[] | null>(null);
  const [ytCategoriesByChannel, setYtCategoriesByChannel] = useState<Record<string, Category[]>>({});
  const [registeringId, setRegisteringId] = useState<string | null>(null);

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

  const contactChannel = channels.find((c) => c.id === contactChannelId) ?? null;

  async function refreshChannels() {
    const res = await fetch("/api/channels");
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
    }
  }

  async function handleYoutubeSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!ytQuery.trim()) return;

    setYtLoading(true);
    setYtError(null);
    setYtResults(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(ytQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
      const results: ChannelCandidate[] = data.candidates;
      setYtResults(results);
      setYtCategoriesByChannel(
        Object.fromEntries(results.map((c) => [c.youtubeChannelId, c.suggestedCategories])),
      );
    } catch (err) {
      setYtError(err instanceof Error ? err.message : "검색에 실패했습니다.");
    } finally {
      setYtLoading(false);
    }
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

  async function registerCandidate(candidate: ChannelCandidate) {
    setRegisteringId(candidate.youtubeChannelId);
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
    setRegisteringId(null);

    if (res.ok) {
      setYtResults(
        (prev) =>
          prev?.map((c) =>
            c.youtubeChannelId === candidate.youtubeChannelId ? { ...c, alreadyRegistered: true } : c,
          ) ?? null,
      );
      await refreshChannels();
    } else {
      alert("등록에 실패했습니다.");
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
          <p className="text-sm text-neutral-500">
            &quot;{ytQuery}&quot; 검색 결과 {ytResults.length}개 계정
          </p>
          {ytResults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
              활동 중인 계정을 찾지 못했습니다.
            </div>
          ) : (
            ytResults.map((c) => (
              <YoutubeCandidateRow
                key={c.youtubeChannelId}
                candidate={c}
                selectedCategories={ytCategoriesByChannel[c.youtubeChannelId] ?? []}
                onToggleCategory={(cat) => toggleYtCategory(c.youtubeChannelId, cat)}
                onRegister={() => registerCandidate(c)}
                registering={registeringId === c.youtubeChannelId}
              />
            ))
          )}
        </div>
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
          {variant === "saved" ? "저장된 채널이 없습니다." : "조건에 맞는 채널이 없습니다."}
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
                <button
                  onClick={() => setContactChannelId(c.id)}
                  className="text-xs font-medium text-neutral-700 hover:underline"
                >
                  컨택하기
                </button>
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
function YoutubeCandidateRow({
  candidate,
  selectedCategories,
  onToggleCategory,
  onRegister,
  registering,
}: {
  candidate: ChannelCandidate;
  selectedCategories: Category[];
  onToggleCategory: (category: Category) => void;
  onRegister: () => void;
  registering: boolean;
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
            {candidate.avgViewsLast6Shorts?.toLocaleString("ko-KR") ?? "숏폼 없음"}
            {candidate.contactEmail ? ` · ${candidate.contactEmail}` : ""}
            {candidate.contactPhone ? ` · ${candidate.contactPhone}` : ""}
            {candidate.contactInstagram ? " · IG" : ""}
          </p>
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
              <button
                onClick={onRegister}
                disabled={registering}
                className="mt-2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {registering ? "등록 중..." : "채널 등록"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
