"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "notice";
  content: string;
};

type ChatRoom = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

const CHAT_STORAGE_KEY = "seocho-ai-chat-rooms-v1";
const FALLBACK_NOTICE = "요청에 실패했습니다.";

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

      const messages = room.messages.filter(isChatMessage);
      if (messages.length === 0) return [];

      return [
        {
          id: room.id,
          title: room.title,
          messages,
          updatedAt:
            typeof room.updatedAt === "number" ? room.updatedAt : Date.now(),
        },
      ];
    })
    .sort((first, second) => second.updatedAt - first.updatedAt);
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

export default function Home() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const messages = activeRoom?.messages ?? [];

  useEffect(() => {
    const restoreStorage = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(CHAT_STORAGE_KEY);
        if (!stored) return;

        const saved = JSON.parse(stored) as {
          rooms?: unknown;
          activeRoomId?: unknown;
        };
        const restoredRooms = restoreChatRooms(saved.rooms);

        setRooms(restoredRooms);
        setActiveRoomId(
          typeof saved.activeRoomId === "string" &&
            restoredRooms.some((room) => room.id === saved.activeRoomId)
            ? saved.activeRoomId
            : null,
        );
      } catch {
        setRooms([]);
        setActiveRoomId(null);
      } finally {
        setStorageReady(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreStorage);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ rooms, activeRoomId }),
    );
  }, [activeRoomId, rooms, storageReady]);

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

  function deleteRoom(roomId: string) {
    const remainingRooms = rooms.filter((room) => room.id !== roomId);
    setRooms(remainingRooms);

    if (activeRoomId === roomId) {
      setActiveRoomId(remainingRooms[0]?.id ?? null);
      setPrompt("");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();

    if (!message || isSending) return;

    const roomId = activeRoomId ?? crypto.randomUUID();
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
          title: message.slice(0, 60),
          messages: [userMessage],
          updatedAt: Date.now(),
        },
        ...current,
      ]);
      setActiveRoomId(roomId);
    }

    setPrompt("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages
            .filter((item) => item.role !== "notice")
            .map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const data = (await response.json()) as {
        code?: string;
        message?: string;
      };

      appendMessageToRoom(roomId, {
        id: crypto.randomUUID(),
        role: data.code ? "notice" : "assistant",
        content: data.message ?? FALLBACK_NOTICE,
      });
    } catch {
      appendMessageToRoom(roomId, {
        id: crypto.randomUUID(),
        role: "notice",
        content: FALLBACK_NOTICE,
      });
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

        {rooms.length > 0 ? (
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
                  onClick={() => deleteRoom(room.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </nav>
        ) : null}
      </aside>

      <main className="main-panel" id="top">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="사이드바 열기"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon />
          </button>
          <span className="topbar-title">서초 AI</span>
        </header>

        <section className="chat-stage">
          <header className="chat-masthead">
            <h1>
              무엇을
              <br />
              도와드릴까요?
            </h1>
          </header>

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
                    <article className="message assistant-message" key={message.id}>
                      <span className="message-label">서초 Agent</span>
                      <p>{message.content}</p>
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
              disabled={isSending}
            />
            <button
              className="send-button"
              type="submit"
              aria-label="메시지 보내기"
              disabled={!prompt.trim() || isSending}
            >
              <ArrowIcon />
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
