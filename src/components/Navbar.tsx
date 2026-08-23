import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export function Navbar({ userEmail }: { userEmail: string | null }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-base font-semibold text-neutral-900">
            인플루언서 발굴 대시보드
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-500">
            <Link href="/" className="hover:text-neutral-900">
              대시보드
            </Link>
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
