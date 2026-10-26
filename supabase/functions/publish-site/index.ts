import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { md5 } from "https://esm.sh/@noble/hashes@1.8.0/md5";

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
    .select("id,organization_id,name,slug,status,html_content,cloudflare_project_name,cloudflare_deployment_id,published_url,published_at")
    .eq("id", siteId).single();
  if (siteError || !site) return reply(404, { error: "Site introuvable ou accès refusé." });
  const { data: membership } = await userDb.from("organization_memberships")
    .select("role").eq("organization_id", site.organization_id).eq("user_id", authData.user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return reply(403, { error: "Seuls le propriétaire ou l’administrateur peuvent publier un site." });
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

    const { projectName, project } = await ensureProject(accountId, cfToken, site, admin);
    const publicUrl = siteUrl(project, projectName);
    const bytes = new TextEncoder().encode(html);
    const hash = await assetHash(bytes);
    const tokenEnvelope = await cloudflareRequest(projectEndpoint(accountId, projectName) + "/upload-token", cfToken);
    const uploadToken = String(tokenEnvelope?.result?.jwt || "");
    if (!uploadToken) throw new Error("Cloudflare n'a pas fourni de jeton de téléversement temporaire.");

    await cloudflareRequest(CF_API + "/pages/assets/upsert-hashes", uploadToken, {
      method: "POST", body: JSON.stringify({ hashes: [hash] })
    });
    const missingEnvelope = await cloudflareRequest(CF_API + "/pages/assets/check-missing", uploadToken, {
      method: "POST", body: JSON.stringify({ hashes: [hash] })
    });
    const missing = Array.isArray(missingEnvelope?.result) ? missingEnvelope.result : [];
    if (missing.includes(hash)) {
      await cloudflareRequest(CF_API + "/pages/assets/upload", uploadToken, {
        method: "POST",
        body: JSON.stringify([{
          base64: true,
          key: hash,
          metadata: { contentType: "text/html; charset=utf-8" },
          value: base64(bytes)
        }])
      });
    }

    const form = new FormData();
    form.set("manifest", JSON.stringify({ "index.html": hash }));
    form.set("branch", "main");
    form.set("commit_dirty", "true");
    form.set("commit_message", "Sama Studio publication " + site.slug);
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
