import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildCopilotSystemPrompt, type CopilotMenuSnapshot } from "@/lib/copilot-prompt.server";
import { buildCopilotTools } from "@/lib/copilot-tools.server";

async function loadMenuSnapshot(sb: unknown): Promise<CopilotMenuSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sb as any;
  const [settingsRes, catsRes, prodsRes] = await Promise.all([
    s.from("site_settings").select("name,is_open").limit(1),
    s.from("categories").select("id,name,active").order("position", { ascending: true }).limit(200),
    s.from("products").select("id,name,price,active,category_id,badge,is_hero,paused_until").limit(500),
  ]);
  const cats = (catsRes.data ?? []) as CopilotMenuSnapshot["categories"];
  const catById = new Map(cats.map((c) => [c.id, c.name]));
  const products = ((prodsRes.data ?? []) as CopilotMenuSnapshot["products"]).map((p) => ({
    ...p,
    category_name: p.category_id ? catById.get(p.category_id) ?? null : null,
  }));
  return {
    settings: (settingsRes.data?.[0] as CopilotMenuSnapshot["settings"]) ?? null,
    categories: cats,
    products,
  };
}



export const Route = createFileRoute("/api/copilot-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Auth: require admin
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401 });

          const { createClient } = await import("@supabase/supabase-js");
          const supaUrl = process.env.SUPABASE_URL!;
          const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(supaUrl, anon, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: userData } = await userClient.auth.getUser();
          const user = userData.user;
          if (!user) return new Response("Unauthorized", { status: 401 });

          const { data: isAdmin } = await userClient.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
          });
          if (!isAdmin) return new Response("Forbidden", { status: 403 });

          const body = (await request.json()) as {
            messages?: UIMessage[];
            threadId?: string | null;
            pageContext?: string | null;
          };
          if (!Array.isArray(body.messages)) {
            return new Response("Messages required", { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const gateway = createLovableAiGatewayProvider(apiKey);
          const tools = buildCopilotTools({
            supabaseAdmin: supabaseAdmin as unknown as Parameters<typeof buildCopilotTools>[0]["supabaseAdmin"],
            apiKey,
            userId: user.id,
            threadId: body.threadId ?? null,
          });

          // Live menu snapshot injected into the system prompt so the AI has
          // real context and never asks about products/categories that are
          // already listed (or missing).
          let menuSnapshot: Awaited<ReturnType<typeof loadMenuSnapshot>> | null = null;
          try {
            menuSnapshot = await loadMenuSnapshot(supabaseAdmin);
          } catch (e) {
            console.error("[copilot-chat] menu snapshot failed", e);
          }

          const result = streamText({
            model: gateway("google/gemini-2.5-flash"),
            system: buildCopilotSystemPrompt(new Date(), body.pageContext ?? undefined, menuSnapshot),
            messages: await convertToModelMessages(body.messages),
            tools,
            stopWhen: stepCountIs(50),
          });


          return result.toUIMessageStreamResponse({
            originalMessages: body.messages,
            onFinish: async ({ messages }) => {
              const threadId = body.threadId;
              if (!threadId) return;
              try {
                const originals = body.messages ?? [];
                const lastUser = [...originals].reverse().find(m => m.role === "user");
                const finalAssistant = messages[messages.length - 1];
                const rows: Array<{ thread_id: string; role: string; parts: unknown }> = [];
                if (lastUser) rows.push({ thread_id: threadId, role: "user", parts: lastUser.parts });
                if (finalAssistant && finalAssistant.role === "assistant") {
                  rows.push({ thread_id: threadId, role: "assistant", parts: finalAssistant.parts });
                }
                if (rows.length) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await supabaseAdmin.from("copilot_messages").insert(rows as any);
                  await supabaseAdmin
                    .from("copilot_threads")
                    .update({ updated_at: new Date().toISOString() })
                    .eq("id", threadId);
                }
              } catch (e) {
                console.error("[copilot] persist error", e);
              }
            },
          });
        } catch (e) {
          console.error("[copilot-chat] error", e);
          return new Response(
            "Erro no Copiloto: " + (e instanceof Error ? e.message : String(e)),
            { status: 500 },
          );
        }
      },
    },
  },
});
