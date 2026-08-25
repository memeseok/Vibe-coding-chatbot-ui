# 서초 AI

Gemini API 키만 등록하면 바로 사용할 수 있는 미니멀한 Next.js 챗봇입니다.

## 현재 구현된 것

- 데스크톱·모바일 반응형 챗봇 UI
- 사용자 메시지 입력과 대화 초기화
- Gemini 대화 이력을 유지하는 `/api/chat` 서버 Route
- 무료 티어를 지원하는 `gemini-3.5-flash-lite` 연동
- API 키가 없을 때 고정된 설정 안내 표시
- API 키가 브라우저에 노출되지 않는 서버 Route 구조

## 로컬 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## Gemini API 키 설정

Google AI Studio에서 새 API 키를 발급한 뒤 `.env` 또는 `.env.local`에 입력합니다. 개인 키는 로컬 개발에서 우선순위가 높은 `.env.local` 사용을 권장합니다.

```env
GEMINI_API_KEY=새로_발급받은_키
```

환경변수를 변경했다면 개발 서버를 재시작합니다. `.env`와 `.env.local`은 Git에 올라가지 않습니다. 키에 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 컴포넌트에서 직접 사용하지 마세요.

## 확인 명령

```bash
npm run lint
npm run typecheck
npm run build
```

## Vercel 배포

1. 본인 GitHub 저장소로 코드를 올립니다.
2. Vercel에서 해당 저장소를 Import합니다.
3. Vercel 프로젝트의 Environment Variables에 `GEMINI_API_KEY`를 등록합니다.
4. 배포를 실행합니다.

## 주요 파일

```text
src/app/page.tsx            # 챗봇 화면과 메시지 상태
src/app/globals.css         # 흑백 편집형 디자인과 반응형 스타일
src/app/api/chat/route.ts   # Gemini API 서버 호출
.env.example                # 필요한 환경 변수 예시
```
