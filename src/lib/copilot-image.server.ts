/**
 * Generate an image via Lovable AI Gateway image endpoint (non-streaming)
 * and upload it to the banner-images bucket. Returns a long-lived signed URL.
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
  size?: "1024x1024" | "1024x1536" | "1536x1024";
}) {
  const styleSuffix =
    ", vibrant modern acai/ice cream shop aesthetic, dark purple background, neon yellow (#facc15) and neon purple (#a855f7) accents, high contrast, mobile-friendly composition, no watermark, no text artifacts";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      messages: [
        { role: "user", content: params.prompt + styleSuffix },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar imagem: ${res.status} ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Modelo não retornou imagem.");

  // base64 → Uint8Array
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const key = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  const up = await params.supabaseAdmin.storage.from("banner-images").upload(key, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (up.error) throw new Error("Falha ao salvar imagem: " + up.error.message);

  // 1-year signed URL (bucket is private)
  const signed = await params.supabaseAdmin.storage
    .from("banner-images")
    .createSignedUrl(key, 60 * 60 * 24 * 365);
  if (signed.error || !signed.data) throw new Error("Falha ao gerar URL: " + signed.error?.message);

  return { url: signed.data.signedUrl, key };
}
