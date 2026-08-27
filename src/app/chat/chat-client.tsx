"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";

export type ChatUser = {
  id: string;
  displayName: string;
  email: string;
  initial: string;
  isAdmin: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "notice";
  content: string;
  sources?: ChatSource[];
  webSearchUsed?: boolean;
};

type ChatSource = {
  title: string;
  url: string;
};

type ChatRoom = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

const CHAT_STORAGE_KEY_PREFIX = "seocho-ai-chat-rooms-v2";
const FALLBACK_NOTICE = "요청에 실패했습니다.";
const HISTORY_ERROR =
  "대화 기록을 저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ChatMessage>;

  return (
    typeof message.id === "string" &&
    (message.role === "user" ||
      message.role === "assistant" ||
      message.role === "notice") &&
    typeof message.content === "string"
  );
}

function isChatSource(value: unknown): value is ChatSource {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Partial<ChatSource>;

  if (typeof source.title !== "string" || typeof source.url !== "string") {
    return false;
  }

  try {
    const url = new URL(source.url);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function restoreChatRooms(value: unknown): ChatRoom[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((candidate) => {
      if (typeof candidate !== "object" || candidate === null) return [];
      const room = candidate as Partial<ChatRoom>;

      if (
        typeof room.id !== "string" ||
        typeof room.title !== "string" ||
        !Array.isArray(room.messages)
      ) {
        return [];
      }

      const messages = room.messages.filter(isChatMessage).map((message) => ({
        ...message,
        sources: Array.isArray(message.sources)
          ? message.sources.filter(isChatSource)
          : undefined,
        webSearchUsed: message.webSearchUsed === true,
      }));
      if (messages.length === 0) return [];

      return [
        {
          id: room.id,
          title: room.title.slice(0, 120),
          messages,
          updatedAt:
            typeof room.updatedAt === "number" &&
            Number.isFinite(room.updatedAt)
              ? room.updatedAt
              : Date.now(),
        },
      ];
    })
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

function parseSources(value: Json): ChatSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources = value.filter(isChatSource);
  return sources.length > 0 ? sources : undefined;
}

async function readChatRooms(
  supabase: SupabaseClient<Database>,
): Promise<ChatRoom[]> {
  const { data: roomRows, error: roomsError } = await supabase
    .from("chat_rooms")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  if (roomsError) throw roomsError;
  if (!roomRows || roomRows.length === 0) return [];

  const roomIds = roomRows.map((room) => room.id);
  const { data: messageRows, error: messagesError } = await supabase
    .from("chat_messages")
    .select(
      "id, room_id, role, content, sources, web_search_used, created_at",
    )
    .in("room_id", roomIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (messagesError) throw messagesError;

  const messagesByRoom = new Map<string, ChatMessage[]>();
  for (const row of messageRows ?? []) {
    if (
      row.role !== "user" &&
      row.role !== "assistant" &&
      row.role !== "notice"
    ) {
      continue;
    }

    const roomMessages = messagesByRoom.get(row.room_id) ?? [];
    roomMessages.push({
      id: row.id,
      role: row.role,
      content: row.content,
      sources: parseSources(row.sources),
      webSearchUsed: row.web_search_used,
    });
    messagesByRoom.set(row.room_id, roomMessages);
  }

  return roomRows.map((room) => ({
    id: room.id,
    title: room.title,
    messages: messagesByRoom.get(room.id) ?? [],
    updatedAt: Date.parse(room.updated_at),
  }));
}

async function migrateLocalHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  storageKey: string,
) {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return false;

  let parsed: { rooms?: unknown };
  try {
    parsed = JSON.parse(stored) as { rooms?: unknown };
  } catch {
    return false;
  }
  const localRooms = restoreChatRooms(parsed.rooms);
  if (localRooms.length === 0) return false;

  const { error: roomsError } = await supabase.from("chat_rooms").upsert(
    localRooms.map((room) => ({
      id: room.id,
      user_id: userId,
      title: room.title,
      created_at: new Date(room.updatedAt).toISOString(),
      updated_at: new Date(room.updatedAt).toISOString(),
    })),
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (roomsError) throw roomsError;

  const messageRows = localRooms.flatMap((room) =>
    room.messages.map((message, index) => ({
      id: message.id,
      room_id: room.id,
      user_id: userId,
      role: message.role,
      content: message.content.slice(0, 32000),
      sources: (message.sources ?? []) as Json,
      web_search_used: message.webSearchUsed === true,
      created_at: new Date(
        room.updatedAt - (room.messages.length - index) * 10,
      ).toISOString(),
    })),
  );

  const { error: messagesError } = await supabase
    .from("chat_messages")
    .upsert(messageRows, { onConflict: "id", ignoreDuplicates: true });

  if (messagesError) throw messagesError;

  localStorage.removeItem(storageKey);
  return true;
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 7-7m-7 7 7 7M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4M8.5 11h5M11 8.5v5" />
    </svg>
  );
}

export default function ChatClient({
  user,
  webSearchAvailable,
}: {
  user: ChatUser;
  webSearchAvailable: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(webSearchAvailable);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chatStorageKey = `${CHAT_STORAGE_KEY_PREFIX}:${user.id}`;

  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const messages = activeRoom?.messages ?? [];

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        let storedRooms = await readChatRooms(supabase);
        if (storedRooms.length === 0) {
          try {
            const migrated = await migrateLocalHistory(
              supabase,
              user.id,
              chatStorageKey,
            );
            if (migrated) storedRooms = await readChatRooms(supabase);
          } catch {
            if (!cancelled) {
              setHistoryError(
                "기존 브라우저 대화 기록을 이전하지 못했습니다. 새 대화는 정상적으로 저장됩니다.",
              );
            }
          }
        }

        if (cancelled) return;
        setRooms(storedRooms);
        setActiveRoomId(storedRooms[0]?.id ?? null);
        setHistoryStatus("ready");
      } catch {
        if (cancelled) return;
        setHistoryStatus("error");
        setHistoryError(HISTORY_ERROR);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [chatStorageKey, supabase, user.id]);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRoomId, isSending, messages.length]);

  function appendMessageToRoom(roomId: string, message: ChatMessage) {
    setRooms((current) => {
      const room = current.find((item) => item.id === roomId);
      if (!room) return current;

      const updatedRoom = {
        ...room,
        messages: [...room.messages, message],
        updatedAt: Date.now(),
      };

      return [updatedRoom, ...current.filter((item) => item.id !== roomId)];
    });
  }

  async function persistMessage(
    roomId: string,
    roomTitle: string,
    message: ChatMessage,
  ) {
    const updatedAt = new Date().toISOString();
    const { error: roomError } = await supabase.from("chat_rooms").upsert(
      {
        id: roomId,
        user_id: user.id,
        title: roomTitle.slice(0, 120),
        updated_at: updatedAt,
      },
      { onConflict: "id" },
    );

    if (roomError) throw roomError;

    const { error: messageError } = await supabase.from("chat_messages").insert({
      id: message.id,
      room_id: roomId,
      user_id: user.id,
      role: message.role,
      content: message.content.slice(0, 32000),
      sources: (message.sources ?? []) as Json,
      web_search_used: message.webSearchUsed === true,
    });

    if (messageError) throw messageError;
  }

  function startNewChat() {
    setActiveRoomId(null);
    setPrompt("");
    setSidebarOpen(false);
  }

  function openRoom(roomId: string) {
    setActiveRoomId(roomId);
    setPrompt("");
    setSidebarOpen(false);
  }

  async function deleteRoom(roomId: string) {
    const previousRooms = rooms;
    const previousActiveRoomId = activeRoomId;
    const remainingRooms = rooms.filter((room) => room.id !== roomId);
    setRooms(remainingRooms);
    setHistoryError(null);

    if (activeRoomId === roomId) {
      setActiveRoomId(remainingRooms[0]?.id ?? null);
      setPrompt("");
    }

    const { error } = await supabase
      .from("chat_rooms")
      .delete()
      .eq("id", roomId);

    if (error) {
      setRooms(previousRooms);
      setActiveRoomId(previousActiveRoomId);
      setHistoryError(HISTORY_ERROR);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();

    if (!message || isSending || historyStatus === "loading") return;

    const roomId = activeRoomId ?? crypto.randomUUID();
    const roomTitle = activeRoom?.title ?? message.slice(0, 60);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };

    if (activeRoomId) {
      appendMessageToRoom(roomId, userMessage);
    } else {
      setRooms((current) => [
        {
          id: roomId,
          title: roomTitle,
          messages: [userMessage],
          updatedAt: Date.now(),
        },
        ...current,
      ]);
      setActiveRoomId(roomId);
    }

    setPrompt("");
    setIsSending(true);
    setHistoryError(null);
    let userMessageSaved = false;

    try {
      await persistMessage(roomId, roomTitle, userMessage);
      userMessageSaved = true;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          useWebSearch: webSearchEnabled,
          history: messages
            .filter((item) => item.role !== "notice")
            .map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const data = (await response.json()) as {
        code?: string;
        message?: string;
        sources?: unknown;
        webSearchUsed?: unknown;
      };

      const sources = Array.isArray(data.sources)
        ? data.sources.filter(isChatSource)
        : undefined;
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: data.code ? "notice" : "assistant",
        content: data.message ?? FALLBACK_NOTICE,
        sources,
        webSearchUsed: data.webSearchUsed === true,
      };

      appendMessageToRoom(roomId, reply);

      try {
        await persistMessage(roomId, roomTitle, reply);
      } catch {
        setHistoryError("답변은 표시했지만 기록 저장에 실패했습니다.");
      }
    } catch {
      const notice: ChatMessage = {
        id: crypto.randomUUID(),
        role: "notice",
        content: userMessageSaved ? FALLBACK_NOTICE : HISTORY_ERROR,
      };
      appendMessageToRoom(roomId, notice);
      setHistoryError(userMessageSaved ? null : HISTORY_ERROR);

      if (userMessageSaved) {
        try {
          await persistMessage(roomId, roomTitle, notice);
        } catch {
          setHistoryError(HISTORY_ERROR);
        }
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="app-shell">
      <button
        className={`sidebar-backdrop ${sidebarOpen ? "is-visible" : ""}`}
        type="button"
        aria-label="사이드바 닫기"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand-row">
            <a className="brand" href="#top" aria-label="서초 AI 홈">
              <span className="brand-mark">S</span>
              <span>서초 AI</span>
            </a>
            <button
              className="icon-button sidebar-close"
              type="button"
              aria-label="사이드바 닫기"
              onClick={() => setSidebarOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <button className="new-chat-button" type="button" onClick={startNewChat}>
          <PlusIcon />
          새 대화
        </button>

        {historyStatus === "loading" ? (
          <p className="history-status">대화 기록을 불러오는 중...</p>
        ) : rooms.length > 0 ? (
          <nav className="conversation-nav" aria-label="대화 목록">
            <span className="section-label">대화</span>
            {rooms.map((room) => (
              <div
                className={`conversation-item ${
                  room.id === activeRoomId ? "is-active" : ""
                }`}
                key={room.id}
              >
                <button
                  className="conversation-select"
                  type="button"
                  aria-current={room.id === activeRoomId ? "page" : undefined}
                  onClick={() => openRoom(room.id)}
                >
                  <span>{room.title}</span>
                </button>
                <button
                  className="delete-room-button"
                  type="button"
                  aria-label={`${room.title} 삭제`}
                  onClick={() => void deleteRoom(room.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </nav>
        ) : (
          <p className="history-status">저장된 대화가 없습니다.</p>
        )}
      </aside>

      <main className="main-panel" id="top">
        <header className="topbar">
          <div className="mobile-topbar-brand">
            <button
              className="icon-button mobile-menu"
              type="button"
              aria-label="사이드바 열기"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon />
            </button>
            <span className="topbar-title">서초 AI</span>
          </div>

          <div className="account-controls">
            <div className="user-summary" aria-label="로그인 사용자">
              <span className="user-initial" aria-hidden="true">
                {user.initial}
              </span>
              <span className="user-copy">
                <strong>{user.displayName}</strong>
                <small>{user.email}</small>
              </span>
            </div>
            {user.isAdmin ? (
              <a className="admin-link" href="/admin">
                관리자
              </a>
            ) : null}
            <form action={signOut}>
              <button className="logout-button" type="submit">
                로그아웃
              </button>
            </form>
          </div>
        </header>

        <section className="chat-stage">
          <header className="chat-masthead">
            <h1>
              무엇을
              <br />
              도와드릴까요?
            </h1>
          </header>

          {historyError ? (
            <p className="chat-history-error" role="alert">
              {historyError}
            </p>
          ) : null}

          <div className="conversation" aria-live="polite">
            {messages.length > 0 ? (
              <div className="message-list">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <article className="message user-message" key={message.id}>
                      <span className="message-label">나</span>
                      <p>{message.content}</p>
                    </article>
                  ) : message.role === "notice" ? (
                    <article className="message notice-message" key={message.id}>
                      <div className="notice-mark" aria-hidden="true">
                        !
                      </div>
                      <p>{message.content}</p>
                    </article>
                  ) : (
                    <article
                      className="message assistant-message"
                      key={message.id}
                    >
                      <div className="assistant-message-meta">
                        <span className="message-label">서초 Agent</span>
                        {message.webSearchUsed ? (
                          <span className="search-badge">실시간 검색</span>
                        ) : null}
                      </div>
                      <p>{message.content}</p>
                      {message.sources && message.sources.length > 0 ? (
                        <div className="source-list">
                          <strong>출처</strong>
                          <ol>
                            {message.sources.map((source, index) => (
                              <li key={`${source.url}:${index}`}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                >
                                  {source.title}
                                </a>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                    </article>
                  ),
                )}
                {isSending ? (
                  <div className="loading-row" role="status">
                    <span />
                    <span />
                    <span />
                    <span className="sr-only">답변 생성 중</span>
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            ) : null}
          </div>
        </section>

        <footer className="composer-wrap">
          <div className="composer-tools">
            <button
              className={`web-search-toggle ${webSearchEnabled ? "is-active" : ""}`}
              type="button"
              aria-pressed={webSearchEnabled}
              onClick={() => setWebSearchEnabled((enabled) => !enabled)}
              disabled={isSending || !webSearchAvailable}
            >
              <SearchIcon />
              실시간 검색
            </button>
            <span>
              {!webSearchAvailable
                ? "Tavily API 키를 설정하면 활성화됩니다."
                : webSearchEnabled
                  ? "Tavily에서 최신 정보를 검색합니다."
                  : "웹 검색 없이 답변합니다."}
            </span>
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="chat-input">
              메시지 입력
            </label>
            <textarea
              id="chat-input"
              rows={1}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="메시지를 입력하세요"
              maxLength={8000}
              disabled={isSending || historyStatus === "loading"}
            />
            <button
              className="send-button"
              type="submit"
              aria-label="메시지 보내기"
              disabled={
                !prompt.trim() || isSending || historyStatus === "loading"
              }
            >
              <ArrowIcon />
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
