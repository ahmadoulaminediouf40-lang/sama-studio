import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[char] || char));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !publishableKey) return reply(500, { error: "Configuration Supabase absente." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Connexion requise." });
  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return reply(401, { error: "Session invalide." });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "Corps JSON invalide." }); }
  const siteId = String(body.site_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return reply(400, { error: "Identifiant de site invalide." });

  const { data: site, error: siteError } = await supabase.from("sites")
    .select("id,organization_id,name,slug,review_status,submitted_at,created_by")
    .eq("id", siteId).single();
  if (siteError || !site) return reply(404, { error: "Site introuvable." });
  const { data: membership, error: membershipError } = await supabase.from("organization_memberships")
    .select("role").eq("organization_id", site.organization_id).eq("user_id", auth.user.id).maybeSingle();
  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    return reply(403, { error: "Vous ne pouvez pas notifier la validation pour ce site." });
  }
  if (site.review_status !== "pending" || !site.submitted_at) {
    return reply(409, { error: "Le site n’attend pas de validation." });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("SAMA_STUDIO_FROM_EMAIL");
  const recipients = (Deno.env.get("SAMA_STUDIO_ADMIN_EMAIL") || "")
    .split(",").map(item => item.trim()).filter(Boolean);
  if (!resendKey || !from || !recipients.length) {
    return reply(503, {
      sent: false,
      email_not_configured: true,
      error: "Le site est enregistré et la notification interne a été créée, mais l’e-mail n’est pas configuré.",
      required_secrets: ["RESEND_API_KEY", "SAMA_STUDIO_ADMIN_EMAIL", "SAMA_STUDIO_FROM_EMAIL"]
    });
  }

  const dashboardUrl = "https://sama-studio-web.pages.dev/sama-dashboard.html";
  const siteName = escapeHtml(site.name);
  const siteSlug = escapeHtml(site.slug);
  const senderName = Deno.env.get("SAMA_STUDIO_SENDER_NAME") || "SAMA Studio";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:32px 20px;color:#183728">
      <div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#17633d">SAMA STUDIO</div>
      <h1 style="font-size:26px;line-height:1.2;margin:22px 0 12px">Nouveau site à valider</h1>
      <p style="font-size:15px;line-height:1.7;color:#586b5e">Un client vient d’enregistrer un site et demande sa validation avant la mise en ligne.</p>
      <div style="border:1px solid #dfe8df;border-radius:12px;padding:18px;margin:22px 0;background:#f8fbf7">
        <div style="font-size:11px;color:#758579">NOM DU SITE</div><strong style="display:block;font-size:18px;margin:5px 0 14px">${siteName}</strong>
        <div style="font-size:11px;color:#758579">IDENTIFIANT</div><span>${siteSlug}</span>
      </div>
      <a href="${dashboardUrl}" style="display:inline-block;background:#17633d;color:#fff;text-decoration:none;padding:13px 18px;border-radius:9px;font-weight:700">Ouvrir la file de validation</a>
      <p style="font-size:11px;color:#8b988d;line-height:1.6;margin-top:26px">Le site reste privé jusqu’à son approbation et sa publication par un gestionnaire autorisé.</p>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: senderName + " <" + from + ">",
      to: recipients,
      subject: "SAMA Studio — nouveau site à valider : " + String(site.name).slice(0, 100),
      html
    })
  });
  const responseText = await response.text();
  if (!response.ok) {
    return reply(502, {
      sent: false,
      error: "Le site est enregistré, mais le fournisseur d’e-mail a refusé le message.",
      provider_status: response.status,
      provider_message: responseText.slice(0, 400)
    });
  }
  return reply(200, { sent: true, site_id: site.id });
});
