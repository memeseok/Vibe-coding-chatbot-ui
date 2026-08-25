"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "notice";
  content: string;
};

const FALLBACK_NOTICE =
  "Gemini API가 연결되지 않았습니다. .env.local에 GEMINI_API_KEY를 입력해 주세요.";

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

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending]);

  function startNewChat() {
    setMessages([]);
    setPrompt("");
    setSidebarOpen(false);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();

    if (!message || isSending) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: message },
    ]);
    setPrompt("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as { message?: string };

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "notice",
          content: data.message ?? FALLBACK_NOTICE,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "notice",
          content: FALLBACK_NOTICE,
        },
      ]);
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

        <nav className="conversation-nav" aria-label="대화 목록">
          <span className="section-label">대화</span>
          <button className="conversation-item is-active" type="button">
            <span>{messages.length ? messages[0].content : "새로운 대화"}</span>
          </button>
        </nav>
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
                  ) : (
                    <article className="message notice-message" key={message.id}>
                      <div className="notice-mark" aria-hidden="true">
                        !
                      </div>
                      <div>
                        <span className="message-label">설정 필요</span>
                        <p>{message.content}</p>
                      </div>
                    </article>
                  ),
                )}
                {isSending ? (
                  <div className="loading-row" role="status">
                    <span />
                    <span />
                    <span />
                    <span className="sr-only">연결 상태 확인 중</span>
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
