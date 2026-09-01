import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export function Navbar({ userEmail }: { userEmail: string | null }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-5">
          {/* 검색창 등 대시보드 상태를 완전히 초기화하기 위해 일부러 일반 링크(전체 새로고침)를 사용한다. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="text-base font-semibold text-neutral-900">
            인플루언서 발굴 대시보드
          </a>
          <nav className="flex items-center gap-4 text-sm text-neutral-500">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="hover:text-neutral-900">
              대시보드
            </a>
            <Link href="/saved" className="hover:text-neutral-900">
              저장 목록
            </Link>
            <Link href="/lists" className="hover:text-neutral-900">
              목록
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && <span className="text-sm text-neutral-500">{userEmail}</span>}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
