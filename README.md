# 서초 AI

Supabase Google OAuth로 보호되는 Next.js AI 챗봇입니다. 로그인하지 않은 사용자는 랜딩 페이지에 머물고, 인증된 사용자만 `/chat`과 `/api/chat`을 이용할 수 있습니다.

## 구현 기능

- 랜딩 페이지의 Google 로그인·회원가입
- Supabase SSR 쿠키 세션과 OAuth PKCE 콜백
- 로그인 사용자만 접근 가능한 `/chat`
- 서버에서 검증한 Google 사용자 이름·이메일 표시
- 우측 상단 로그아웃과 랜딩 페이지 복귀
- 인증되지 않은 `/api/chat` 요청 차단
- Tavily 실시간 웹 검색 토글과 출처 링크 표시
- Supabase DB에 저장되는 사용자별 대화방·메시지 기록
- 재로그인 후 과거 대화 자동 복원과 기존 브라우저 기록 1회 이전
- RLS로 보장되는 사용자별 대화 데이터 격리
- Google 관리자 로그인과 사용자 전체 대화 기록 대시보드
- Vercel 배포 설정과 Node.js 22 런타임

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`에 아래 값을 입력합니다.

```env
GEMINI_API_KEY=Google_AI_Studio_API_KEY
TAVILY_API_KEY=Tavily_API_KEY
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_key
```

`GEMINI_API_KEY`와 `TAVILY_API_KEY`는 서버에서만 사용합니다. Supabase Publishable key는 공개 클라이언트용이며 `service_role` 또는 Secret key를 브라우저 환경변수에 넣으면 안 됩니다.

`SUPABASE_SECRET_KEY`는 아래 관리자 권한 부여·해제 명령에서만 사용하는 로컬 전용 값입니다. 애플리케이션 실행이나 Vercel 배포에는 필요하지 않으며, `NEXT_PUBLIC_` 접두사를 붙이거나 Git에 커밋하면 안 됩니다.

## 채팅 기록 데이터베이스

대상 Supabase 프로젝트에는 다음 마이그레이션이 적용됩니다.

- `profiles`: 관리자 화면에서 확인할 인증 사용자 정보
- `chat_rooms`: 사용자별 대화방과 정렬 시각
- `chat_messages`: 사용자 질문, AI 답변, 검색 출처 사용 여부

모든 테이블은 RLS가 활성화되어 있습니다. 일반 회원은 자신의 데이터만 조회·작성·삭제할 수 있고, `app_metadata.app_role=admin`인 계정만 전체 기록을 읽을 수 있습니다. 기존 `localStorage` 대화는 해당 사용자의 DB 기록이 비어 있을 때 최초 1회 자동 이전됩니다.

새 Supabase 프로젝트에 직접 적용할 때는 프로젝트를 연결한 뒤 마이그레이션을 실행합니다.

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 관리자 계정 설정

관리자는 일반 회원과 동일하게 Google로 인증하지만, 서버가 부여한 관리자 역할이 있어야 `/admin`에 접근할 수 있습니다.

1. 관리자로 사용할 Google 계정으로 웹사이트에서 한 번 회원가입합니다.
2. Supabase Dashboard의 **Connect → API Keys**에서 `sb_secret_...` Secret key를 복사합니다.
3. 로컬 `.env.local`에만 `SUPABASE_SECRET_KEY`를 추가합니다.
4. 다음 명령으로 권한을 부여합니다.

   ```bash
   npm run admin:grant -- admin@example.com
   ```

5. 해당 계정에서 로그아웃 후 다시 로그인하고 `/admin/login` 또는 `/admin`으로 이동합니다.

관리자 권한을 해제하려면 다음 명령을 실행합니다.

```bash
npm run admin:revoke -- admin@example.com
```

Secret key는 관리자 권한 명령이 실행되는 로컬 컴퓨터에만 두세요. 관리자 대시보드는 로그인 사용자의 JWT와 RLS로 데이터를 조회하므로 Vercel에는 `SUPABASE_SECRET_KEY`를 등록하지 않습니다.

Tavily MCP는 Codex 같은 MCP 클라이언트에서 개발 작업에 사용하는 연결입니다. Vercel에서 실행되는 웹사이트는 MCP 설정을 상속하지 않으므로, 채팅 Route Handler가 `TAVILY_API_KEY`로 Tavily Search API를 호출합니다. 키가 설정되어 있으면 채팅 화면의 **실시간 검색** 버튼이 기본 활성화되며, 검색 기반 답변에는 출처 링크가 함께 표시됩니다. 키가 없으면 검색 버튼만 비활성화되고 일반 채팅은 계속 사용할 수 있습니다.

Tavily API 키는 [Tavily Dashboard](https://app.tavily.com/)에서 발급한 뒤 로컬 `.env.local`과 Vercel의 Production 환경변수에 각각 등록합니다. 키를 추가하거나 변경한 Vercel 배포는 반드시 Redeploy해야 합니다.

Vercel의 변수 값에는 `TAVILY_API_KEY=`, `Bearer`, 따옴표를 붙이지 않고 `tvly-`로 시작하는 실제 키 값만 넣는 것을 권장합니다. 서버는 흔한 접두사와 따옴표 입력을 정규화하지만, 마스킹된 화면 문자열이나 키 이름은 실제 API 키로 사용할 수 없습니다.

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## Google OAuth 설정

대상 Supabase 프로젝트에서는 Google Provider가 활성화되어 있어야 합니다.

1. Google Cloud Console에서 Web OAuth Client를 만듭니다.
2. Google의 **Authorized redirect URI**에 다음 Supabase 콜백을 등록합니다.

   ```text
   https://typcwfbbvlcgutlmhjwq.supabase.co/auth/v1/callback
   ```

3. Supabase Dashboard의 **Authentication → Providers → Google**에 Client ID와 Client Secret을 등록합니다.
4. Supabase Dashboard의 **Authentication → URL Configuration**에 다음 URL을 허용합니다.

   ```text
   http://localhost:3000/auth/callback
   https://YOUR_VERCEL_DOMAIN/auth/callback
   ```

배포 후 `Site URL`을 실제 Vercel 도메인으로 지정하는 것을 권장합니다.

## Vercel 배포

1. 이 GitHub 저장소를 Vercel에 Import합니다.
2. Vercel 프로젝트의 **Environment Variables**에 다음 네 값을 등록합니다.

   - `GEMINI_API_KEY`
   - `TAVILY_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

3. Production, Preview, Development 환경에 필요한 범위를 선택합니다.
4. 배포 후 실제 도메인의 `/auth/callback`을 Supabase Redirect URLs에 추가합니다.
5. Redeploy한 뒤 Google 로그인, `/chat` 보호, 로그아웃을 확인합니다.

`vercel.json`, `.nvmrc`, `package.json`의 Node 엔진 설정이 포함되어 있습니다.

## 확인 명령

```bash
npm run lint
npm run typecheck
npm run build
```

## 주요 파일

```text
src/app/page.tsx                  # 로그인 랜딩 페이지
src/app/google-login-button.tsx   # Google OAuth 시작 버튼
src/app/auth/callback/route.ts    # PKCE 인증 코드 교환
src/app/auth/actions.ts           # 로그아웃 Server Action
src/app/chat/page.tsx             # 보호된 채팅 페이지·사용자 조회
src/app/chat/chat-client.tsx      # 채팅 UI와 Supabase 대화 기록 저장·복원
src/app/admin/login/page.tsx      # 관리자 전용 Google 로그인 진입점
src/app/admin/page.tsx            # 사용자별 전체 대화 기록 대시보드
src/app/api/chat/route.ts         # 인증·Tavily 검색이 적용된 Gemini API Route
src/lib/tavily.ts                 # Tavily Search API와 출처 정규화
src/lib/supabase/*                # 브라우저·서버·Proxy 클라이언트와 DB 타입
src/proxy.ts                      # 세션 갱신과 라우트 보호
scripts/set-admin-role.mjs        # 관리자 역할 부여·해제 로컬 명령
supabase/migrations/*             # 채팅 저장 스키마·RLS 마이그레이션
```
