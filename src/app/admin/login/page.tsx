import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { GoogleLoginButton } from "@/app/google-login-button";
import { createClient } from "@/lib/supabase/server";

type AdminLoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  let isSignedInMember = false;

  if (claimsData?.claims?.sub) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.app_metadata?.app_role === "admin") redirect("/admin");
    isSignedInMember = Boolean(user);
  }

  const params = await searchParams;
  const isForbidden = params.error === "forbidden" || isSignedInMember;

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <a className="brand" href="/" aria-label="서초 AI 홈">
          <span className="brand-mark">S</span>
          <span>서초 AI</span>
        </a>
        <span className="admin-kicker">ADMIN ACCESS</span>
        <h1>관리자 로그인</h1>
        <p>
          관리자 권한이 등록된 Google 계정만 전체 사용자 대화 기록을 확인할
          수 있습니다.
        </p>

        {isForbidden ? (
          <div className="admin-login-actions">
            <p className="admin-access-error" role="alert">
              현재 계정에는 관리자 권한이 없습니다.
            </p>
            <form action={signOut}>
              <button className="google-login-button" type="submit">
                다른 Google 계정으로 로그인
              </button>
            </form>
            <a className="admin-back-link" href="/chat">
              채팅으로 돌아가기
            </a>
          </div>
        ) : (
          <GoogleLoginButton
            nextPath="/admin"
            label="관리자 Google 계정으로 계속하기"
          />
        )}
      </section>
    </main>
  );
}
