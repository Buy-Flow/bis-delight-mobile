import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import { useUnreadNotifications } from "./NotificationsInbox";

export function NotificationsBell() {
  const { isAuthenticated } = useAuth();
  const unread = useUnreadNotifications();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={() => navigate({ to: "/conta", search: { tab: "notificacoes" } as never })}
      aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
      className="relative grid h-11 w-11 place-items-center rounded-2xl card-acai text-neon-cyan active:scale-95 transition"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-neon-pink px-1 text-[10px] font-black text-white shadow-[0_0_10px_rgba(236,72,153,0.7)]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
