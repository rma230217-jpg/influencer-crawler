# 인플루언서 발굴 대시보드 (MVP: 유튜브)

`influencer_crawler_spec.md` 스펙 기반으로 구현된 유튜브 인플루언서 발굴 웹 대시보드입니다.
Next.js(App Router) + Supabase(Postgres/Auth) + YouTube Data API v3 로 구성되어 있습니다.

## 0. 준비물

- Supabase 계정 (https://supabase.com)
- Google Cloud 계정 (YouTube Data API v3 키 발급용)
- Vercel 계정 (배포용, 선택)
- Node.js 20+ / npm

---

## 1. Supabase 프로젝트 생성

1. https://supabase.com/dashboard 접속 → **New Project** 클릭
2. Organization 선택 (없으면 새로 생성), 프로젝트 이름 예: `influencer-crawler`
3. Database Password를 설정하고 저장해둡니다 (비밀번호 관리자에 보관 권장).
4. Region은 팀 위치와 가까운 곳(예: Northeast Asia - Seoul 이 있다면 선택) 선택 후 **Create new project**
5. 프로비저닝이 끝날 때까지 1~2분 대기합니다.

### 1-1. API 키/URL 확인

프로젝트가 생성되면 왼쪽 사이드바 맨 아래 **⚙️ Settings → API Keys** 메뉴에서 아래 값을 확인해 `.env.local`에 사용합니다. (예전 "Project Settings → API" 경로는 개편되어 사라졌습니다.)

- 같은 페이지 상단(또는 **Connect** 다이얼로그)에서 `Project URL` 확인 → `NEXT_PUBLIC_SUPABASE_URL`
- **"Publishable and secret API keys"** 탭 선택 (2025년 이후 새 프로젝트는 이 탭만 존재):
  - `Publishable key` (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `Secret keys`의 값 (`sb_secret_...`) → `SUPABASE_SECRET_KEY` (⚠️ 절대 클라이언트/공개 저장소에 노출 금지, 서버 전용)

> 오래된 프로젝트라 **"Legacy API Keys"** 탭에 `anon public` / `service_role` 키가 남아있다면, 그 값을 각각 `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`로 대신 넣어도 코드가 자동으로 인식합니다 (`.env.local.example` 하단 참고). 두 체계는 동일한 권한 수준(같은 RLS 동작)이라 어느 쪽을 써도 무방합니다.

### 1-2. DB 스키마 적용

`supabase/migrations/` 안의 SQL 파일들을 **번호 순서대로** Supabase 대시보드의 **SQL Editor**에 붙여넣고 실행하세요 (또는 Supabase CLI가 있다면 `supabase link` 후 `supabase db push`).

- **`0001_init.sql`**: `channel_category` enum (뷰티/패션/푸드/리빙-홈/육아/반려동물/살림), `channels` 테이블, `channel_categories` 다대다 테이블, RLS(Row Level Security) 정책 — **로그인한 팀원(authenticated)만** 읽기/쓰기 가능 (내부용 툴이므로 외부 비공개)
- **`0002_v2_features.sql`**: 통합 검색용 `description` 컬럼, 컨택하기용 `contact_phone`/`contact_instagram` 컬럼, 저장 목록(즐겨찾기)용 `saved_channels` 테이블 + RLS

### 1-3. 팀원 로그인 계정 만들기 (Supabase Auth)

스펙상 "로그인이 필요한 내부용 툴 (외부 공개 X)"이므로, 공개 회원가입 없이 관리자가 팀원 계정을 직접 만듭니다.

1. Supabase 대시보드 → **Authentication → Users → Add user**
2. 이메일 + 임시 비밀번호를 입력해 팀원 계정을 생성 (또는 "Send invitation" 사용)
3. **Authentication → Providers → Email** 에서 "Allow new users to sign up"을 꺼두면 앱에 별도 회원가입 화면이 없어도 안전합니다 (이 프로젝트는 로그인 화면만 제공하며 회원가입 UI 자체가 없습니다).

---

## 2. YouTube Data API v3 키 발급

1. https://console.cloud.google.com 접속 → 새 프로젝트 생성 (또는 기존 프로젝트 사용)
2. **APIs & Services → Library** 에서 "YouTube Data API v3" 검색 후 **Enable**
3. **APIs & Services → Credentials → Create Credentials → API key** 로 키 생성
4. (권장) 생성된 키를 **Restrict key**로 들어가 "YouTube Data API v3"로 API 제한을 걸어둡니다.
5. 무료 할당량은 하루 10,000 유니트이며, 채널 검색(100유니트) + 채널/영상 조회(각 1유니트) 수준이라 일반적인 팀 사용 규모에서는 충분합니다.

---

## 3. 로컬 환경 설정 & 실행

```bash
cp .env.local.example .env.local
# .env.local을 열어 위에서 발급받은 값들을 채워 넣습니다.

npm install
npm run dev
```

http://localhost:3000 접속 → Supabase에서 만든 팀원 계정으로 로그인합니다.

### 필요한 환경 변수

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (레거시 프로젝트는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SECRET_KEY` | Supabase secret key (서버 전용, cron 갱신에 사용. 레거시 프로젝트는 `SUPABASE_SERVICE_ROLE_KEY`) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 키 (서버 전용) |
| `CRON_SECRET` | `/api/channels/refresh` 보호용 임의 문자열 |

---

## 4. 주요 기능

- **로그인** (`/login`): Supabase Auth 이메일/비밀번호 로그인. 회원가입 UI 없음.
- **대시보드** (`/`): 카테고리 탭 필터, 통합 검색(채널명/소개란/이메일/카테고리), 구독자 수·평균 조회수 정렬(기본값: 평균 조회수 높은순), 카드/테이블 뷰 전환, 채널 삭제, 저장(즐겨찾기) 토글, 컨택하기, 엑셀(CSV) 다운로드.
- **신규 채널 추가** (`/channels/add`): 키워드로 YouTube 채널 검색 → 후보 목록(구독자 수, 최근 숏폼 평균 조회수, 연락처 미리보기, 자동분류된 카테고리) → 필요시 카테고리 수정 → 등록. (이 플로우는 실시간 YouTube 검색 전용이며, 대시보드 통합 검색과는 별개입니다.)
- **저장 목록** (`/saved`): 팀 전체가 공유하는 즐겨찾기 목록. 대시보드와 동일하게 카테고리 탭/검색/정렬 사용 가능.
- **자동 갱신** (`/api/channels/refresh`): 등록된 모든 채널의 구독자 수 / 최근 숏폼 6개 평균 조회수 / 소개란을 최신 데이터로 갱신. Vercel Cron이 매일 1회 호출 (`vercel.json`, 03:00 KST). 카테고리와 연락처(이메일/전화번호/인스타그램)는 최초 등록 시 값 또는 팀원이 수동으로 채운 값을 그대로 유지하며, 갱신 시 덮어쓰지 않습니다 (비어있는 연락처만 자동 재추출로 채움).

### 통합 검색 범위 (9.1)

메인 대시보드 검색창은 **이미 등록된 채널**만 대상으로 합니다 (채널명/소개란/이메일/카테고리에서 검색어를 찾음). 아직 등록되지 않은 새 채널을 유튜브에서 실시간으로 찾으려면 기존과 동일하게 "+ 신규 채널 추가" 플로우를 사용하세요.

### 컨택하기 (9.3)

각 채널의 "컨택하기" 버튼을 누르면 이메일/전화번호/인스타그램 링크를 모아 보여주는 창이 뜹니다. 전화번호·인스타그램은 소개란에 공개적으로 적혀 있을 때만 자동으로 채워지고(놓치는 경우가 많음), 이 창에서 직접 입력해 저장할 수도 있습니다. 한 번 채워진 연락처는 매일 자동 갱신에서 덮어써지지 않습니다.

### 엑셀 다운로드 (9.4)

"엑셀 다운로드" 버튼은 현재 화면에 필터/정렬된 목록 그대로를 CSV로 내보냅니다 (엑셀에서 바로 열림, 컬럼: 계정명/채널 URL/구독자수/평균조회수/카테고리/이메일/전화번호/인스타그램 링크). 진짜 `.xlsx`를 생성하는 `xlsx`(SheetJS) npm 패키지는 패치되지 않은 고위험 취약점이 있어 일부러 사용하지 않았습니다 — CSV는 추가 의존성 없이 Excel/Google Sheets에서 바로 열리고 이메일 발송용 목록으로 쓰기에 동일하게 활용 가능합니다.

### 저장 목록 (9.5)

기본값은 **팀 전체 공유** 저장 목록입니다 (누가 저장했는지는 DB에는 기록되지만 화면엔 별도 표시하지 않음). 팀원별 개인 저장 목록이 필요하면 요청해주세요 — `saved_channels` 테이블에 이미 `saved_by` 컬럼이 있어 개인별 목록으로 확장하기 어렵지 않습니다.

### 평균 조회수 계산 방식

채널의 최근 업로드 영상(최대 20개)을 최신순으로 조회한 뒤, 영상 길이가 60초 이하인 숏폼만 필터링해 그중 가장 최근 6개의 조회수 평균을 계산합니다. 최근 20개 안에 숏폼이 6개 미만이면 있는 만큼만 평균을 냅니다.

### 연락처 수집 방식

채널 소개란(description)에 공개적으로 적힌 이메일 주소를 정규식으로 추출합니다 (비공개 정보는 수집하지 않음).

### 카테고리 자동분류 방식

채널명 + 소개란 + 최근 업로드 영상 제목을 합친 텍스트에서 카테고리별 키워드(`src/lib/categorize.ts`)를 매칭해 하나 이상의 카테고리를 자동으로 제안합니다. 채널 추가 화면에서 자동 제안된 카테고리가 기본으로 선택돼 있으며, 배지를 클릭해 바로 수정할 수 있습니다. 등록 후에도 대시보드의 "수정" 버튼으로 카테고리를 언제든 고칠 수 있고, 어떤 키워드에도 안 걸리면 "미분류" 상태로 등록되어 수동 태깅이 필요함을 바로 알 수 있습니다.

---

## 5. Vercel 배포

1. https://vercel.com/new 에서 이 저장소(GitHub)를 Import
2. **Environment Variables**에 위 5개 환경 변수를 모두 등록 (Production/Preview 모두 권장)
3. Deploy

`vercel.json`에 정의된 Cron(`0 18 * * *`, UTC 기준 = 매일 KST 03:00)이 배포와 함께 자동 등록되어 `/api/channels/refresh`를 매일 호출합니다. Vercel은 `CRON_SECRET` 환경 변수가 설정되어 있으면 Cron 요청에 자동으로 `Authorization: Bearer $CRON_SECRET` 헤더를 붙여 보내므로, 이 값만 Vercel 환경 변수에 등록해두면 별도 설정이 필요 없습니다.

> Cron은 Vercel Hobby 플랜에서는 하루 1회 이상 스케줄을 지원하지 않을 수 있습니다. 필요 시 Vercel 대시보드의 Cron 설정에서 스케줄을 조정하세요.

---

## 6. 향후 확장

- 인스타그램 연동 (`channels.platform` 필드로 이미 확장 가능하게 설계됨)
- 저장 목록 개인별 관리로 전환
- 연락 이력 관리 (제안 발송 체크, 응답 상태)
- 진짜 `.xlsx` 내보내기가 꼭 필요해지면, 신뢰할 수 있는 라이브러리(예: `exceljs`)로 교체 검토
