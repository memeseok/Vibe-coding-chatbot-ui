import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { message?: unknown };

  if (typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json(
      { message: "메시지를 입력해 주세요." },
      { status: 400 },
    );
  }

  // TODO: 학생 실습 영역
  // 1. Gemini SDK를 설치합니다.
  // 2. process.env.GEMINI_API_KEY를 서버에서 읽습니다.
  // 3. body.message를 Gemini에 전달하고 생성된 답변을 반환합니다.
  // API 키는 클라이언트 컴포넌트나 NEXT_PUBLIC_ 환경 변수에 넣지 마세요.
  return NextResponse.json(
    {
      code: "GEMINI_NOT_CONNECTED",
      message:
        "Gemini API가 연결되지 않았습니다. .env.local에 GEMINI_API_KEY를 입력해 주세요.",
    },
  );
}
