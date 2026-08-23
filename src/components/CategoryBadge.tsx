import type { Category } from "@/lib/types";

const CATEGORY_STYLES: Record<Category, string> = {
  "뷰티": "bg-pink-100 text-pink-800",
  "패션": "bg-purple-100 text-purple-800",
  "푸드": "bg-orange-100 text-orange-800",
  "리빙/홈": "bg-teal-100 text-teal-800",
  "육아": "bg-yellow-100 text-yellow-800",
  "반려동물": "bg-lime-100 text-lime-800",
  "살림": "bg-sky-100 text-sky-800",
  "건강": "bg-green-100 text-green-800",
  "헬스": "bg-red-100 text-red-800",
  "사주": "bg-indigo-100 text-indigo-800",
};

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category]}`}
    >
      {category}
    </span>
  );
}
