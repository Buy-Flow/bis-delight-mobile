/**
 * Generate an image via Lovable AI Gateway (chat-shape Gemini image model)
 * and upload it to the banner-images bucket. Returns a long-lived signed URL.
 *
 * Per ai-image-generation: Gemini image models take the chat-completions
 * shape (messages + modalities) at /v1/images/generations, and the Gateway
 * normalizes the response into the OpenAI images shape (data[0].b64_json).
 */
export async function generateAndUploadBanner(params: {
  prompt: string;
  apiKey: string;
  supabaseAdmin: {
    storage: {
      from: (b: string) => {
        upload: (path: string, body: Uint8Array, opts?: { contentType?: string; upsert?: boolean }) => Promise<{ error: { message: string } | null }>;
        createSignedUrl: (path: string, expires: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
      };
    };
  };
}) {
  const styleSuffix =
    ". Estilo: fundo escuro roxo/preto, destaques em amarelo neon (#facc15) e roxo (#a855f7), alto contraste, composição centralizada mobile-friendly, sem watermark, sem texto artificial, moderno açaí/sorveteria.";

  const body = {
    model: "google/gemini-2.5-flash-image",
    messages: [{ role: "user", content: params.prompt + styleSuffix }],
    modalities: ["image", "text"],
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar imagem: ${res.status} ${t.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string }>;
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
  };

  // Primary path: normalized OpenAI images shape
  let b64 = json?.data?.[0]?.b64_json ?? "";

  // Fallback: raw chat-completions shape (data URL in image_url.url)
  if (!b64) {
    const u = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
    if (u.startsWith("data:image")) {
      b64 = u.split(",")[1] ?? "";
    }
  }

  if (!b64) throw new Error("Modelo não retornou imagem. Resposta: " + JSON.stringify(json).slice(0, 200));

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const key = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  const up = await params.supabaseAdmin.storage.from("banner-images").upload(key, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (up.error) throw new Error("Falha ao salvar imagem: " + up.error.message);

  // 1-year signed URL (bucket is private per workspace policy)
  const signed = await params.supabaseAdmin.storage
    .from("banner-images")
    .createSignedUrl(key, 60 * 60 * 24 * 365);
  if (signed.error || !signed.data) throw new Error("Falha ao gerar URL: " + signed.error?.message);

  return { image_url: signed.data.signedUrl, key };
}
