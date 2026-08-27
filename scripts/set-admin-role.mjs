import { existsSync } from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const [action, rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

if ((action !== "grant" && action !== "revoke") || !email) {
  console.error(
    "사용법: npm run admin:grant -- admin@example.com 또는 npm run admin:revoke -- admin@example.com",
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    ".env.local에 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY를 설정해 주세요.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(targetEmail) {
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === targetEmail,
    );
    if (user) return user;
    if (data.users.length < perPage) return null;
  }
}

try {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`Supabase Auth에서 ${email} 사용자를 찾지 못했습니다.`);
  }

  const appMetadata = { ...user.app_metadata };
  if (action === "grant") {
    appMetadata.app_role = "admin";
  } else {
    delete appMetadata.app_role;
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: appMetadata,
  });

  if (error) throw error;

  console.log(
    action === "grant"
      ? `${email} 계정에 관리자 권한을 부여했습니다. 브라우저에서 다시 로그인한 뒤 /admin으로 이동하세요.`
      : `${email} 계정의 관리자 권한을 해제했습니다. 기존 세션은 로그아웃하면 갱신됩니다.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "관리자 권한 변경에 실패했습니다.",
  );
  process.exit(1);
}
