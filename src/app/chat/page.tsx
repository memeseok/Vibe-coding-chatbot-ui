import { redirect } from "next/navigation";
import ChatClient, { type ChatUser } from "./chat-client";
import { createClient } from "@/lib/supabase/server";
import { getTavilyApiKey } from "@/lib/tavily";

function getDisplayName(metadata: Record<string, unknown>, email: string) {
  for (const key of ["full_name", "name", "user_name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return email.split("@")[0] || "사용자";
}

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) redirect("/");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/");

  const email = user.email ?? "Google 사용자";
  const displayName = getDisplayName(user.user_metadata, email);
  const chatUser: ChatUser = {
    id: user.id,
    displayName,
    email,
    initial: displayName.slice(0, 1).toUpperCase(),
    isAdmin: user.app_metadata?.app_role === "admin",
  };

  return (
    <ChatClient
      user={chatUser}
      webSearchAvailable={Boolean(getTavilyApiKey(process.env.TAVILY_API_KEY))}
    />
  );
}
