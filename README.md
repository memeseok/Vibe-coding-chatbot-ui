# 서초 AI

Supabase Google OAuth로 보호되는 Next.js AI 챗봇입니다. 로그인하지 않은 사용자는 랜딩 페이지에 머물고, 인증된 사용자만 `/chat`과 `/api/chat`을 이용할 수 있습니다.

## 구현 기능

- 랜딩 페이지의 Google 로그인·회원가입
- Supabase SSR 쿠키 세션과 OAuth PKCE 콜백
- 로그인 사용자만 접근 가능한 `/chat`
- 서버에서 검증한 Google 사용자 이름·이메일 표시
- 우측 상단 로그아웃과 랜딩 페이지 복귀
- 인증되지 않은 `/api/chat` 요청 차단
- 사용자별로 분리된 브라우저 채팅 기록
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
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

`GEMINI_API_KEY`는 서버에서만 사용합니다. Supabase Publishable key는 공개 클라이언트용이며 `service_role` 또는 Secret key를 브라우저 환경변수에 넣으면 안 됩니다.

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
2. Vercel 프로젝트의 **Environment Variables**에 다음 세 값을 등록합니다.

   - `GEMINI_API_KEY`
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
src/app/chat/chat-client.tsx      # 채팅 UI와 사용자별 로컬 기록
src/app/api/chat/route.ts         # 인증이 적용된 Gemini API Route
src/lib/supabase/*                # 브라우저·서버·Proxy 클라이언트
src/proxy.ts                      # 세션 갱신과 라우트 보호
```
