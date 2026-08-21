"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, type Category, type Channel, type SortDirection, type SortKey } from "@/lib/types";
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

export function Dashboard({ initialChannels }: { initialChannels: Channel[] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [activeCategory, setActiveCategory] = useState<Category | "전체">("전체");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("subscriber_count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<"card" | "table">("table");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);

  const filtered = useMemo(() => {
    let list = channels;

    if (activeCategory !== "전체") {
      list = list.filter((c) => c.categories.includes(activeCategory));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.channel_name.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return sortDirection === "desc" ? bv - av : av - bv;
    });
  }, [channels, activeCategory, search, sortKey, sortDirection]);

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

  return (
    <div>
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

        <Link
          href="/channels/add"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + 신규 채널 추가
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="채널명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
        >
          <option value="subscriber_count">구독자 수</option>
          <option value="avg_views_last_6_shorts">평균 조회수</option>
        </select>

        <select
          value={sortDirection}
          onChange={(e) => setSortDirection(e.target.value as SortDirection)}
          className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
        >
          <option value="desc">내림차순</option>
          <option value="asc">오름차순</option>
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
          조건에 맞는 채널이 없습니다.
        </div>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">채널명</th>
                <th className="px-4 py-2 font-medium">구독자 수</th>
                <th className="px-4 py-2 font-medium">평균 조회수</th>
                <th className="px-4 py-2 font-medium">카테고리</th>
                <th className="px-4 py-2 font-medium">연락처</th>
                <th className="px-4 py-2 font-medium">최종 업데이트</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
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
                  <td className="px-4 py-2 text-neutral-700">{c.contact_email ?? "-"}</td>
                  <td className="px-4 py-2 text-neutral-500">{formatDate(c.last_updated_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      삭제
                    </button>
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
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  삭제
                </button>
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
                <div className="flex justify-between">
                  <dt>연락처</dt>
                  <dd>{c.contact_email ?? "-"}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-neutral-400">최종 업데이트 {formatDate(c.last_updated_at)}</p>
            </div>
          ))}
        </div>
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
