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
- **`0003_lists.sql`**: 이름 붙여 채널을 분류하는 목록 기능용 `lists`/`list_channels` 테이블 + RLS

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
- **대시보드** (`/`): 상단 검색창에 키워드/채널명/주제를 입력하면 **유튜브에서 실시간으로** 그 주제로 활동 중인 계정 목록을 바로 보여주고(개수 제한 없이 "더 보기"로 계속 이어서 조회 가능), 결과마다 이메일/전화번호/인스타그램을 바로 보여줍니다. 카테고리를 지정해 "채널 등록"을 누르면 어느 목록에 넣을지 고르는 창이 뜹니다. 그 아래는 이미 등록된 채널 목록으로, 카테고리 탭 필터, 구독자 수·평균 조회수 정렬(기본값: 평균 조회수 높은순), 카드/테이블 뷰 전환, 채널 삭제, 저장(즐겨찾기) 토글, 컨택하기, 엑셀(CSV) 다운로드를 제공합니다.
- **신규 채널 추가** (`/channels/add`): 대시보드 상단 검색이 생기기 전 쓰던 페이지로, 여러 채널을 한 번에 골라 일괄 등록하고 싶을 때 여전히 쓸 수 있습니다 (직접 URL로 접속). 기본 진입 동선은 이제 대시보드 검색입니다.
- **목록** (`/lists`, `/lists/[id]`): 이름을 붙여 채널을 분류하는 팀 공유 목록. 채널 등록 시 새로 만들거나 기존 목록에 바로 추가할 수 있고, 목록 상세 화면은 대시보드와 동일한 카테고리 탭/정렬/컨택하기를 그대로 제공합니다.
- **저장 목록** (`/saved`): 팀 전체가 공유하는 단일 즐겨찾기 목록(★ 토글). "목록"과는 별개 기능입니다 — 저장 목록은 이름 없이 빠르게 별표만 치는 용도, 목록은 이름 붙여 여러 개로 나눠 관리하는 용도. 대시보드와 동일하게 카테고리 탭/정렬 사용 가능.
- **자동 갱신** (`/api/channels/refresh`): 등록된 모든 채널의 구독자 수 / 최근 숏폼 6개 평균 조회수 / 소개란을 최신 데이터로 갱신. Vercel Cron이 매일 1회 호출 (`vercel.json`, 03:00 KST). 카테고리와 연락처(이메일/전화번호/인스타그램)는 최초 등록 시 값 또는 팀원이 수동으로 채운 값을 그대로 유지하며, 갱신 시 덮어쓰지 않습니다 (비어있는 연락처만 자동 재추출로 채움).

### 메인 검색 범위

메인 대시보드 상단 검색창은 **유튜브 실시간 검색 전용**입니다 — 검색어와 관련해 현재 활동 중인 계정을 유튜브 API로 그때그때 찾아오며, 이미 등록된 채널은 "이미 등록됨"으로 표시되고 새 채널은 결과에서 바로 카테고리를 골라 등록할 수 있습니다. (DB에 등록된 채널 자체를 이름으로 빠르게 찾고 싶다면 카테고리 탭으로 좁힌 뒤 목록에서 눈으로 확인하면 됩니다 — 등록 채널 수 자체가 많지 않은 내부 도구 특성상 별도 텍스트 검색은 두지 않았습니다.)

한 번의 검색 요청은 YouTube API 한도상 최대 50개까지만 반환하지만(더 큰 값을 요청해도 API가 자동으로 잘라냄), "더 보기" 버튼으로 다음 페이지를 계속 이어서 불러올 수 있어 사실상 개수 제한 없이 끝까지 조회할 수 있습니다. 다만 검색 한 번(첫 페이지 포함) + "더 보기" 한 번마다 YouTube 할당량을 100유니트씩 추가로 소비하니, 하루 10,000유니트 한도를 자주 넘나든다면 "더 보기"를 남용하지 않는 게 좋습니다.

검색 결과가 뜨면 그 위에 **조회수 범위 / 구독자 범위 / 영상 업로드 날짜 범위** 필터가 나타납니다. 이미 불러온 검색 결과(현재 페이지 + "더 보기"로 추가로 불러온 페이지 포함)를 대상으로 즉시 좁혀서 보여주는 방식이라, 필터 값을 바꿔도 YouTube에 다시 요청하지 않습니다(할당량 소비 없음). 조회수는 최근 숏폼 평균 조회수, 업로드 날짜는 채널의 가장 최근 업로드 영상 기준입니다.

### 채널 등록 시 오류가 나는 경우

`0002_v2_features.sql`(연락처 확장 컬럼)이나 `0003_lists.sql`(목록 테이블)을 아직 실행하지 않았다면, DB에 없는 컬럼/테이블을 참조하다 등록이 실패합니다. 등록 실패 메시지는 이제 서버가 보낸 실제 오류 문구를 그대로 보여주므로, 마이그레이션을 다 실행했는데도 실패한다면 그 문구를 보고 원인을 좁힐 수 있습니다.

### 컨택하기

각 채널의 "컨택하기" 버튼을 누르면 이메일/전화번호/인스타그램 링크를 모아 보여주는 창이 뜹니다. 검색 결과 목록에서도 채널마다 이메일/전화번호/인스타그램을 바로 볼 수 있습니다. 전화번호·인스타그램은 소개란에 공개적으로 적혀 있을 때만 자동으로 채워지고(놓치는 경우가 많음), 컨택하기 창에서 직접 입력해 저장할 수도 있습니다. 한 번 채워진 연락처는 매일 자동 갱신에서 덮어써지지 않습니다.

### 엑셀 다운로드

"엑셀 다운로드" 버튼은 현재 화면에 필터/정렬된 목록 그대로를 CSV로 내보냅니다 (엑셀에서 바로 열림, 컬럼: 계정명/채널 URL/구독자수/평균조회수/카테고리/이메일/전화번호/인스타그램 링크). 진짜 `.xlsx`를 생성하는 `xlsx`(SheetJS) npm 패키지는 패치되지 않은 고위험 취약점이 있어 일부러 사용하지 않았습니다 — CSV는 추가 의존성 없이 Excel/Google Sheets에서 바로 열리고 이메일 발송용 목록으로 쓰기에 동일하게 활용 가능합니다.

### 목록(리스트) 기능

검색 결과에서 "채널 등록"을 누르면 어느 목록에 넣을지 고르는 창이 뜹니다:

- 기존 목록은 버튼으로 보여지며 클릭 한 번이면 바로 추가됩니다.
- 그 자리에서 새 목록 이름을 입력해 만들면서 동시에 추가할 수도 있습니다.
- "목록에 추가하지 않고 등록만"을 누르면 목록 지정 없이 채널만 등록됩니다.

`/lists`에서 전체 목록과 채널 개수를 볼 수 있고, 각 목록(`/lists/[id]`)은 대시보드와 같은 화면(카테고리 탭/정렬/컨택하기)으로 그 목록에 속한 채널만 보여줍니다. 팀 전체가 공유하며, 채널 하나가 여러 목록에 동시에 속할 수 있습니다. 기존 "저장 목록"(★, 단일 즐겨찾기)과는 독립적으로 동작합니다.

### 저장 목록

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
