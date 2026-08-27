import { redirect } from "next/navigation";
import { GoogleLoginButton } from "./google-login-button";
import { createClient } from "@/lib/supabase/server";

type LandingPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) redirect("/chat");

  const params = await searchParams;
  const hasAuthError = params.error === "oauth";

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="brand" href="#top" aria-label="서초 AI 홈">
          <span className="brand-mark">S</span>
          <span>서초 AI</span>
        </a>
        <span className="landing-nav-note">AI CONVERSATION STUDIO</span>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-eyebrow">PRIVATE · FAST · SIMPLE</div>
        <h1>
          생각을 묻고,
          <br />
          답을 발견하세요.
        </h1>
        <p className="landing-copy">
          Google 계정으로 시작하는 개인 AI 대화 공간입니다.
          <br />
          로그인한 사용자만 채팅을 이용할 수 있습니다.
        </p>

        <GoogleLoginButton />

        {hasAuthError ? (
          <p className="landing-auth-error" role="alert">
            로그인을 완료하지 못했습니다. Google 계정을 다시 선택해 주세요.
          </p>
        ) : null}
      </section>

      <footer className="landing-footer">
        <span>SUPABASE AUTH</span>
        <span>GEMINI POWERED</span>
        <span>SEOCHO AI © 2026</span>
      </footer>
    </main>
  );
}
