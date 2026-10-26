import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { md5 } from "https://esm.sh/@noble/hashes@1.8.0/legacy";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};
const CF_API = "https://api.cloudflare.com/client/v4";

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function readDefaultKey(envName: string): string {
  try {
    const parsed = JSON.parse(Deno.env.get(envName) || "{}");
    return typeof parsed.default === "string" ? parsed.default : "";
  } catch {
    return "";
  }
}
function publishableKey() {
  return Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    || readDefaultKey("SUPABASE_PUBLISHABLE_KEYS");
}
function secretKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SECRET_KEY")
    || readDefaultKey("SUPABASE_SECRET_KEYS");
}
function readStoreData(html: string) {
  const marker = "window.SAMA_STORE_DATA=";
  const startIndex = html.indexOf(marker);
  if (startIndex < 0) throw new Error("Ce fichier n'est pas un export HTML de Sama Studio (données du catalogue absentes).");
  const start = startIndex + marker.length;
  const end = html.indexOf(";(", start);
  if (end < 0) throw new Error("Configuration du site illisible. Regénérez le fichier HTML depuis Sama Studio.");
  let data: Record<string, any>;
  try {
    data = JSON.parse(html.slice(start, end));
  } catch {
    throw new Error("Configuration du site corrompue.");
  }
  return { data, marker, start, end };
}
function hex(bytes: Uint8Array) {
  return Array.from(bytes).map(value => value.toString(16).padStart(2, "0")).join("");
}
function assetHash(bytes: Uint8Array) {
  // Cloudflare Pages Direct Upload asset keys are 32-character MD5 hex digests.
  return hex(md5(bytes));
}
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  }
  return btoa(binary);
}
async function cloudflareRequest(url: string, token: string, init: RequestInit = {}, allowNotFound = false) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", "Bearer " + token);
  if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const raw = await response.text();
  let result: Record<string, any> = {};
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    result = { message: raw.slice(0, 260) };
  }
  if (allowNotFound && response.status === 404) return null;
  const errors = Array.isArray(result.errors) ? result.errors : [];
  if (!response.ok || result.success === false || errors.length > 0) {
    const detail = errors.map((item: Record<string, unknown>) => String(item.message || "")).filter(Boolean).join("; ");
    throw new Error("Cloudflare API (" + response.status + "): " + (detail || String(result.message || "requête refusée")).slice(0, 260));
  }
  return result;
}
function projectEndpoint(accountId: string, projectName: string) {
  return CF_API + "/accounts/" + encodeURIComponent(accountId) + "/pages/projects/" + encodeURIComponent(projectName);
}
function deploymentState(deployment: Record<string, any>) {
  return String(deployment?.latest_stage?.status || deployment?.status || deployment?.deployment_state || "").toLowerCase();
}
function siteUrl(project: Record<string, any>, projectName: string) {
  const host = String(project?.subdomain || (projectName + ".pages.dev")).replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return "https://" + host;
}
async function ensureProject(accountId: string, token: string, site: Record<string, any>, admin: any) {
  const generatedName = "sama-" + String(site.slug).slice(0, 45) + "-" + String(site.id).replace(/-/g, "").slice(0, 6);
  const projectName = String(site.cloudflare_project_name || generatedName).toLowerCase();
  const endpoint = projectEndpoint(accountId, projectName);
  let envelope = await cloudflareRequest(endpoint, token, { method: "GET" }, true);
  let project = envelope?.result;
  if (!project) {
    envelope = await cloudflareRequest(CF_API + "/accounts/" + encodeURIComponent(accountId) + "/pages/projects", token, {
      method: "POST",
      body: JSON.stringify({ name: projectName, production_branch: "main" })
    });
    project = envelope?.result;
    if (!project) throw new Error("Cloudflare n'a pas retourné les informations du projet Pages.");
  }
  if (site.cloudflare_project_name !== projectName) {
    const { error } = await admin.from("sites").update({ cloudflare_project_name: projectName }).eq("id", site.id);
    if (error) throw new Error("Projet Cloudflare créé, mais son identifiant ne peut pas être enregistré.");
  }
  return { projectName, project };
}
async function getDeployment(accountId: string, projectName: string, deploymentId: string, token: string) {
  const endpoint = projectEndpoint(accountId, projectName) + "/deployments/" + encodeURIComponent(deploymentId);
  const envelope = await cloudflareRequest(endpoint, token, {}, true);
  return envelope?.result || null;
}
async function waitForDeployment(accountId: string, projectName: string, deployment: Record<string, any>, token: string, attempts: number) {
  let current = deployment;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = deploymentState(current);
    if (status === "success") return current;
    if (status === "failure" || status === "canceled") {
      throw new Error("Cloudflare Pages a échoué pendant le déploiement. Vérifie l'état du projet Pages.");
    }
    await new Promise(resolve => setTimeout(resolve, 900));
    current = (await getDeployment(accountId, projectName, String(deployment.id), token)) || current;
  }
  return current;
}
async function markPublished(admin: any, siteId: string, html: string, projectName: string, deploymentId: string, url: string) {
  const { error } = await admin.from("sites").update({
    html_content: html,
    cloudflare_project_name: projectName,
    cloudflare_deployment_id: deploymentId,
    published_url: url,
    status: "published",
    published_at: new Date().toISOString()
  }).eq("id", siteId);
  if (error) throw new Error("Le site est en ligne, mais le statut n'a pas pu être enregistré. Réessaie la publication.");
}

// Static multi-page publishing is handled in this deployment function.
function escapePageText(value: unknown): string {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
    return entities[char] || char;
  });
}
function renderSitePage(page: Record<string, any>, siteName: string, pages: Record<string, any>[]): string {
  const title = escapePageText(page.seo_title || page.title || siteName);
  const description = escapePageText(page.seo_description || "");
  const value = page.content;
  const raw = typeof value === "string" ? value : String(value?.body ?? value?.content ?? "");
  const content = escapePageText(raw).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>\n");
  const links = pages.filter((item) => item.show_in_menu !== false && item.slug !== "home").map((item) => '<a href="/' + encodeURIComponent(String(item.slug)) + '/">' + escapePageText(item.title) + '</a>').join(" ");
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>' + (description ? '<meta name="description" content="' + description + '">' : '') + '<style>body{font:16px/1.7 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#17231b}nav{display:flex;gap:16px;flex-wrap:wrap;margin:20px 0}a{color:#286340}main{margin-top:48px}</style></head><body><header><a href="/">' + escapePageText(siteName) + '</a><nav aria-label="Navigation"><a href="/">Accueil</a>' + links + '</nav></header><main><h1>' + escapePageText(page.title || siteName) + '</h1><article>' + content + '</article></main></body></html>';
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = publishableKey();
  const service = secretKey();
  const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  if (!url || !anon || !service) return reply(500, { error: "Les clés Supabase nécessaires ne sont pas disponibles dans les secrets de la fonction." });
  if (!cfToken || !accountId) return reply(503, { error: "Publication Cloudflare indisponible : configure CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID dans Supabase Edge Function Secrets." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Connexion requise." });
  const userDb = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: authData, error: authError } = await userDb.auth.getUser();
  if (authError || !authData.user) return reply(401, { error: "Session invalide. Reconnectez-vous." });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "Corps JSON invalide." }); }
  const siteId = String(body.site_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return reply(400, { error: "Identifiant de site invalide." });

  const { data: site, error: siteError } = await userDb.from("sites")
    .select("id,organization_id,name,slug,status,review_status,submitted_at,html_content,cloudflare_project_name,cloudflare_deployment_id,published_url,published_at")
    .eq("id", siteId).single();
  if (siteError || !site) return reply(404, { error: "Site introuvable ou accès refusé." });
  const { data: membership } = await userDb.from("organization_memberships")
    .select("role").eq("organization_id", site.organization_id).eq("user_id", authData.user.id).maybeSingle();
  const { data: platformAdmin, error: platformAdminError } = await userDb.from("site_management_admins")
    .select("user_id").eq("user_id", authData.user.id).maybeSingle();
  if (platformAdminError) return reply(403, { error: "Impossible de vérifier les droits de publication." });
  const isPlatformAdmin = Boolean(platformAdmin);
  const isOrgAdmin = Boolean(membership && ["owner", "admin"].includes(membership.role));
  if (!isOrgAdmin && !isPlatformAdmin) {
    return reply(403, { error: "Seul le propriétaire, l’administrateur ou un gestionnaire SAMA Studio autorisé peut publier." });
  }
  if (!site.submitted_at || site.review_status !== "approved") {
    return reply(409, { error: "Ce site doit d’abord être envoyé et approuvé par SAMA Studio avant sa publication." });
  }
  const { data: organization } = await userDb.from("organizations")
    .select("account_status").eq("id", site.organization_id).maybeSingle();
  if (!isPlatformAdmin && organization?.account_status !== "active") {
    return reply(403, { error: "Le compte doit être activé par SAMA Studio avant la publication." });
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // Resume a previously queued deployment instead of making duplicate deployments on retry.
    if (site.cloudflare_project_name && site.cloudflare_deployment_id) {
      const prior = await getDeployment(accountId, site.cloudflare_project_name, String(site.cloudflare_deployment_id), cfToken);
      if (prior) {
        const state = deploymentState(prior);
        if (state === "success" && site.status !== "published") {
          const { data: p } = await cloudflareRequest(projectEndpoint(accountId, site.cloudflare_project_name), cfToken);
          const urlToPublish = siteUrl(p?.result, site.cloudflare_project_name);
          await markPublished(admin, site.id, String(site.html_content || ""), site.cloudflare_project_name, String(site.cloudflare_deployment_id), urlToPublish);
          return reply(200, { status: "published", url: urlToPublish, site_id: site.id, deploy_id: site.cloudflare_deployment_id });
        }
        if (state !== "success" && state !== "failure" && state !== "canceled") {
          const current = await waitForDeployment(accountId, site.cloudflare_project_name, prior, cfToken, 10);
          const finalState = deploymentState(current);
          if (finalState === "success") {
            const projectInfo = await cloudflareRequest(projectEndpoint(accountId, site.cloudflare_project_name), cfToken);
            const urlToPublish = siteUrl(projectInfo?.result, site.cloudflare_project_name);
            await markPublished(admin, site.id, String(site.html_content || ""), site.cloudflare_project_name, String(site.cloudflare_deployment_id), urlToPublish);
            return reply(200, { status: "published", url: urlToPublish, site_id: site.id, deploy_id: site.cloudflare_deployment_id });
          }
          if (finalState !== "failure" && finalState !== "canceled") {
            return reply(202, { status: "deploying", message: "Cloudflare traite encore le site. Clique de nouveau sur Publier dans quelques instants.", deploy_id: site.cloudflare_deployment_id });
          }
        }
      }
      await admin.from("sites").update({ cloudflare_deployment_id: null }).eq("id", site.id);
    }

    let html = String(site.html_content || "");
    if (!html.toLowerCase().includes("<!doctype html") || html.length > 2_900_000) {
      return reply(422, { error: "HTML absent ou trop volumineux (limite 2,9 Mo). Réimporte un export HTML valide." });
    }
    let parsed: ReturnType<typeof readStoreData>;
    try { parsed = readStoreData(html); } catch (error) {
      return reply(422, { error: error instanceof Error ? error.message : "Configuration du site invalide." });
    }
    const { data: rows, error: productsError } = await userDb.from("products")
      .select("id,external_ref,sku,name,category,description,image_url,price,price_label,currency,stock_quantity,is_active,is_demo")
      .eq("site_id", site.id).eq("is_active", true).eq("is_demo", false).order("created_at", { ascending: true });
    if (productsError) return reply(500, { error: "Impossible de lire l’inventaire du site." });
    if (!rows?.length) return reply(422, { error: "Ajoute au moins un produit actif et vérifié dans l’inventaire avant publication." });

    const data = parsed.data as Record<string, any>;
    if (!data.business || typeof data.business !== "object") return reply(422, { error: "Informations de l’entreprise absentes du fichier." });
    data.products = rows.map((product: Record<string, any>) => ({
      id: product.id,
      external_ref: product.external_ref,
      name: product.name,
      category: product.category || "Catalogue",
      price: product.price_label || (new Intl.NumberFormat("fr-FR").format(Number(product.price || 0)) + " " + (product.currency || "XOF")),
      price_value: Number(product.price || 0),
      currency: product.currency || "XOF",
      description: product.description || "",
      image: product.image_url || "",
      stock_quantity: Number(product.stock_quantity || 0)
    }));
    const dataStart = html.indexOf(parsed.marker) + parsed.marker.length;
    const dataEnd = html.indexOf(";(", dataStart);
    html = html.slice(0, dataStart) + safeJson(data) + html.slice(dataEnd);
    // Remove any config injected by a previous publication before inserting the current one.
    html = html.replace(/window\.SAMA_STOREFRONT_CONFIG=\{[^;]*\};/g, "");
    const config = { apiUrl: url, publishableKey: anon, siteSlug: site.slug };
    const configScript = "window.SAMA_STOREFRONT_CONFIG=" + safeJson(config) + ";";
    const markerIndex = html.indexOf("window.SAMA_STORE_DATA=");
    html = html.slice(0, markerIndex) + configScript + html.slice(markerIndex);

    const { data: pageRows, error: pageError } = await admin.from("site_pages")
      .select("title,slug,content,seo_title,seo_description,show_in_menu,status,menu_order")
      .eq("site_id", site.id).eq("organization_id", site.organization_id).eq("status", "published")
      .order("menu_order", { ascending: true }).order("created_at", { ascending: true });
    if (pageError) return reply(500, { error: "Impossible de charger les pages publiées." });
    const pages = (pageRows || []).filter((page: Record<string, any>) => page.slug !== "home" && /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(String(page.slug || "")));
    const pageLinks = pages.filter((page: Record<string, any>) => page.show_in_menu !== false).map((page: Record<string, any>) => '<a href="/' + encodeURIComponent(String(page.slug)) + '/">' + escapePageText(page.title) + '</a>').join("");
    if (pageLinks) html = html.replace("<body", '<body><nav aria-label="Pages du site" style="display:flex;gap:16px;flex-wrap:wrap;padding:16px;font:600 16px system-ui">' + pageLinks + "</nav><div");

    const { projectName, project } = await ensureProject(accountId, cfToken, site, admin);
    const publicUrl = siteUrl(project, projectName);
    const assets: Record<string, { hash: string; bytes: Uint8Array; contentType: string }> = {};
    function addHtmlAsset(path: string, body: string) {
      const bytes = new TextEncoder().encode(body);
      assets[path] = { hash: assetHash(bytes), bytes, contentType: "text/html; charset=utf-8" };
    }
    addHtmlAsset("index.html", html);
    for (const page of pages) addHtmlAsset(String(page.slug) + "/index.html", renderSitePage(page, String(site.name || "Site"), pages));

    const tokenEnvelope = await cloudflareRequest(projectEndpoint(accountId, projectName) + "/upload-token", cfToken);
    const uploadToken = String(tokenEnvelope?.result?.jwt || "");
    if (!uploadToken) throw new Error("Cloudflare n’a pas fourni de jeton de téléversement temporaire.");
    const hashes = [...new Set(Object.values(assets).map((asset) => asset.hash))];
    await cloudflareRequest(CF_API + "/pages/assets/upsert-hashes", uploadToken, { method: "POST", body: JSON.stringify({ hashes }) });
    const missingEnvelope = await cloudflareRequest(CF_API + "/pages/assets/check-missing", uploadToken, { method: "POST", body: JSON.stringify({ hashes }) });
    const missing = new Set(Array.isArray(missingEnvelope?.result) ? missingEnvelope.result : []);
    const uploads = Object.values(assets).filter((asset) => missing.has(asset.hash));
    for (let offset = 0; offset < uploads.length; offset += 10) {
      await cloudflareRequest(CF_API + "/pages/assets/upload", uploadToken, {
        method: "POST", body: JSON.stringify(uploads.slice(offset, offset + 10).map((asset) => ({ base64: true, key: asset.hash, metadata: { contentType: asset.contentType }, value: base64(asset.bytes) })))
      });
    }
    const manifest = Object.fromEntries(Object.entries(assets).map(([path, asset]) => [path, asset.hash]));
    const form = new FormData();
    form.set("manifest", JSON.stringify(manifest));
    form.set("branch", "main");
    form.set("commit_dirty", "true");
    form.set("commit_message", "Sama Studio publication " + site.slug + " (" + pages.length + " pages)");
    const deployEnvelope = await cloudflareRequest(projectEndpoint(accountId, projectName) + "/deployments", cfToken, {
      method: "POST", body: form
    });
    const deployment = deployEnvelope?.result;
    const deploymentId = String(deployment?.id || "");
    if (!deploymentId) throw new Error("Cloudflare n’a pas retourné l’identifiant du déploiement.");

    const { error: savePendingError } = await admin.from("sites")
      .update({ html_content: html, cloudflare_project_name: projectName, cloudflare_deployment_id: deploymentId })
      .eq("id", site.id);
    if (savePendingError) throw new Error("Le déploiement a démarré, mais son identifiant n’a pas pu être enregistré.");

    const finalDeployment = await waitForDeployment(accountId, projectName, deployment, cfToken, 14);
    const finalState = deploymentState(finalDeployment);
    if (finalState !== "success") {
      return reply(202, {
        status: "deploying",
        message: "Cloudflare traite encore le site. Clique de nouveau sur Publier dans quelques instants.",
        deploy_id: deploymentId
      });
    }
    await markPublished(admin, site.id, html, projectName, deploymentId, publicUrl);
    return reply(200, { status: "published", url: publicUrl, site_id: site.id, deploy_id: deploymentId });
  } catch (error) {
    console.error("publish-site failed", error);
    return reply(502, { error: error instanceof Error ? error.message : "Publication Cloudflare échouée. Vérifie le jeton et réessaie." });
  }
});
