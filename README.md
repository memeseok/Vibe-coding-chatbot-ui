# Vibe Coding Chatbot UI

Gemini API를 연결하기 **바로 전 단계**까지 구현된 바이브코딩 수업용 챗봇입니다. 국민연금 강의 프로젝트의 흑백 편집형 UI를 바탕으로, Vercel에 바로 배포할 수 있는 Next.js 구조로 다시 만들었습니다.

## 현재 구현된 것

- 데스크톱·모바일 반응형 챗봇 UI
- 사용자 메시지 입력과 대화 초기화
- 클라이언트에서 `/api/chat`으로 요청을 보내는 흐름
- Gemini 미연결 상태를 알려 주는 서버 API 응답
- API 키가 브라우저에 노출되지 않는 서버 Route 구조

현재는 메시지를 입력해도 AI 답변을 만들지 않습니다. 대신 `GEMINI_API_KEY`를 설정하고 API 연동을 구현하라는 안내가 표시됩니다.

## 로컬 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 학생 실습 미션

에이전트에게 다음과 같이 요청해 보세요.

> 이 Next.js 챗봇에 Gemini 무료 API를 연결해줘. GEMINI_API_KEY는 서버에서만 사용하고, 기존 UI와 /api/chat 요청 구조는 유지해줘.

연동 지점은 [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts)입니다. 실제 키는 `.env.local`에 넣습니다.

```env
GEMINI_API_KEY=여기에_발급받은_키
```

`.env.local`은 Git에 올라가지 않습니다. 키에 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 컴포넌트에서 직접 사용하지 마세요.

## 확인 명령

```bash
npm run lint
npm run typecheck
npm run build
```

## Vercel 배포

1. 본인 GitHub 저장소로 코드를 올립니다.
2. Vercel에서 해당 저장소를 Import합니다.
3. Gemini 연동 후 Vercel 프로젝트의 Environment Variables에 `GEMINI_API_KEY`를 등록합니다.
4. 배포를 실행합니다.

## 주요 파일

```text
src/app/page.tsx            # 챗봇 화면과 메시지 상태
src/app/globals.css         # 흑백 편집형 디자인과 반응형 스타일
src/app/api/chat/route.ts   # Gemini API를 구현할 실습 지점
.env.example                # 필요한 환경 변수 예시
```
