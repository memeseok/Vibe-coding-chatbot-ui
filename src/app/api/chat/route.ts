import { GoogleGenAI, type Content } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "gemini-3.5-flash-lite";

type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

function toGeminiHistory(value: unknown): Content[] {
  if (!Array.isArray(value)) return [];

  const items = value.filter(
    (item): item is ChatHistoryItem =>
      typeof item === "object" &&
      item !== null &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" &&
      Boolean(item.content.trim()),
  );

  const completedTurns: ChatHistoryItem[] = [];
  for (const item of items) {
    const expectedRole = completedTurns.length % 2 === 0 ? "user" : "assistant";
    if (item.role === expectedRole) completedTurns.push(item);
  }

  if (completedTurns.at(-1)?.role === "user") completedTurns.pop();

  return completedTurns.slice(-20).map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content.slice(0, 8_000) }],
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    message?: unknown;
    history?: unknown;
  };

  if (typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json(
      { message: "메시지를 입력해 주세요." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      code: "GEMINI_API_KEY_MISSING",
      message: "Gemini API 키를 설정해 주세요.",
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: MODEL,
      history: toGeminiHistory(body.history),
    });
    const response = await chat.sendMessage({ message: body.message.trim() });
    const message = response.text?.trim();

    if (!message) throw new Error("Gemini returned an empty response");

    return NextResponse.json({ message });
  } catch {
    console.error("Gemini API request failed");
    return NextResponse.json({
      code: "GEMINI_REQUEST_FAILED",
      message: "Gemini API 요청에 실패했습니다.",
    });
  }
}
