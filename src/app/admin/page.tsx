import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type AdminMessage = Pick<
  Database["public"]["Tables"]["chat_messages"]["Row"],
  "id" | "room_id" | "role" | "content" | "web_search_used" | "created_at"
>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function getRoleLabel(role: string) {
  if (role === "user") return "사용자";
  if (role === "assistant") return "서초 Agent";
  return "알림";
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) redirect("/admin/login");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/admin/login");
  if (user.app_metadata?.app_role !== "admin") {
    redirect("/admin/login?error=forbidden");
  }

  const [profilesResult, roomsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name")
      .order("created_at", { ascending: false }),
    supabase
      .from("chat_rooms")
      .select("id, user_id, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
  ]);

  if (profilesResult.error || roomsResult.error) {
    throw new Error("관리자 대화 기록을 불러오지 못했습니다.");
  }

  const rooms = roomsResult.data ?? [];
  const roomIds = rooms.map((room) => room.id);
  const messagesResult =
    roomIds.length > 0
      ? await supabase
          .from("chat_messages")
          .select(
            "id, room_id, role, content, web_search_used, created_at",
          )
          .in("room_id", roomIds)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      : { data: [], error: null };

  if (messagesResult.error) {
    throw new Error("관리자 메시지 기록을 불러오지 못했습니다.");
  }

  const profiles = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );
  const messagesByRoom = new Map<string, AdminMessage[]>();

  for (const message of messagesResult.data ?? []) {
    const roomMessages = messagesByRoom.get(message.room_id) ?? [];
    roomMessages.push(message);
    messagesByRoom.set(message.room_id, roomMessages);
  }

  const roomsByUser = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const userRooms = roomsByUser.get(room.user_id) ?? [];
    userRooms.push(room);
    roomsByUser.set(room.user_id, userRooms);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <span className="admin-kicker">ADMIN CONSOLE</span>
          <h1>사용자 대화 기록</h1>
          <p>최근 업데이트된 대화방 최대 100개를 표시합니다.</p>
        </div>
        <div className="admin-header-actions">
          <a className="admin-back-link" href="/chat">
            채팅으로 이동
          </a>
          <form action={signOut}>
            <button className="logout-button" type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <section className="admin-summary" aria-label="대화 기록 요약">
        <div>
          <strong>{roomsByUser.size}</strong>
          <span>대화 사용자</span>
        </div>
        <div>
          <strong>{rooms.length}</strong>
          <span>대화방</span>
        </div>
        <div>
          <strong>{messagesResult.data?.length ?? 0}</strong>
          <span>메시지</span>
        </div>
      </section>

      <section className="admin-user-list">
        {roomsByUser.size > 0 ? (
          Array.from(roomsByUser.entries()).map(([userId, userRooms]) => {
            const profile = profiles.get(userId);

            return (
              <article className="admin-user-card" key={userId}>
                <header>
                  <div>
                    <span className="admin-kicker">USER</span>
                    <h2>{profile?.display_name ?? "알 수 없는 사용자"}</h2>
                    <p>{profile?.email ?? userId}</p>
                  </div>
                  <span>{userRooms.length}개 대화</span>
                </header>

                <div className="admin-room-list">
                  {userRooms.map((room) => {
                    const roomMessages = messagesByRoom.get(room.id) ?? [];

                    return (
                      <details className="admin-room" key={room.id}>
                        <summary>
                          <span>{room.title}</span>
                          <small>
                            {roomMessages.length}개 메시지 · {formatDate(room.updated_at)}
                          </small>
                        </summary>
                        <div className="admin-message-list">
                          {roomMessages.map((message) => (
                            <article
                              className={`admin-message admin-message-${message.role}`}
                              key={message.id}
                            >
                              <header>
                                <strong>{getRoleLabel(message.role)}</strong>
                                <span>{formatDate(message.created_at)}</span>
                              </header>
                              <p>{message.content}</p>
                              {message.web_search_used ? (
                                <small>실시간 검색 사용</small>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </article>
            );
          })
        ) : (
          <div className="admin-empty-state">
            <h2>저장된 대화가 없습니다.</h2>
            <p>회원이 채팅을 시작하면 이곳에 기록이 표시됩니다.</p>
          </div>
        )}
      </section>
    </main>
  );
}
