import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_CONFIG = { url: "https://jubrkdxrjvkjdlodslcp.supabase.co", key: "sb_publishable_HqIc0fSxhQ9iDThqFXl55g_SJTEiM5h" };
const CONFIG_KEY = "sama_studio_supabase_config_v1";
const config = (() => { try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") }; } catch { return DEFAULT_CONFIG; } })();
const supabase = createClient(config.url.replace(/\/$/, ""), config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const $ = (s, root = document) => root.querySelector(s);
const ui = {
  site: $("#cmsSiteSelect"), status: $("#cmsStatus"), form: $("#cmsPageForm"), list: $("#cmsPageList"),
  title: $("#cmsPageTitle"), slug: $("#cmsPageSlug"), seoTitle: $("#cmsSeoTitle"), seoDescription: $("#cmsSeoDescription"),
  content: $("#cmsPageContent"), visible: $("#cmsShowInMenu"), pageId: $("#cmsPageId"),
  save: $("#cmsSavePageBtn"), newPage: $("#cmsNewPageBtn"), mediaInput: $("#cmsMediaInput"),
  mediaList: $("#cmsMediaList"), revisionLabel: $("#cmsRevisionLabel"), revisionList: $("#cmsRevisionList"),
  saveRevision: $("#cmsSaveRevisionBtn"), restoreHint: $("#cmsRestoreHint")
};
if (ui.site && ui.form) init();

function announce(message, error = false) {
  ui.status.textContent = message;
  ui.status.classList.toggle("cms-error", error);
}
function node(tag, cls, value) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value !== undefined) el.textContent = String(value);
  return el;
}
function makeButton(label, action, secondary = false) {
  const button = node("button", secondary ? "btn btn-outline cms-small-btn" : "btn btn-primary cms-small-btn", label);
  button.type = "button";
  button.addEventListener("click", action);
  return button;
}
function slugify(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "nouvelle-page";
}
function busy(button, yes, label) {
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = yes;
  button.textContent = yes ? label : button.dataset.label;
}
async function init() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return announce("Connexion non disponible. Recharge le tableau de bord.", true);
  if (!sessionData.session) {
    announce("Connecte-toi pour gérer les pages, les images et les versions.");
    supabase.auth.onAuthStateChange((event, session) => { if (session) void loadSites(); });
    return;
  }
  await loadSites();
  ui.site.addEventListener("change", () => { void loadAll(); });
  ui.form.addEventListener("submit", savePage);
  ui.newPage.addEventListener("click", clearPageForm);
  ui.saveRevision.addEventListener("click", saveRevision);
  ui.mediaInput.addEventListener("change", uploadMedia);
  ui.title.addEventListener("input", () => { if (!ui.pageId.value) ui.slug.value = slugify(ui.title.value); });
}
async function loadSites() {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return announce("Connecte-toi pour continuer.", true);
    const { data: memberships, error: membershipError } = await supabase.from("organization_memberships")
      .select("organization_id,role").eq("user_id", authData.user.id);
    if (membershipError) throw membershipError;
    const orgIds = (memberships || []).map(x => x.organization_id);
    if (!orgIds.length) return announce("Aucun espace entreprise associé à ce compte.", true);
    const savedOrg = localStorage.getItem("sama_studio_active_org_v1");
    const orgId = orgIds.includes(savedOrg) ? savedOrg : orgIds[0];
    const { data: sites, error } = await supabase.from("sites")
      .select("id,name,organization_id,status,html_content,review_status,published_url")
      .eq("organization_id", orgId).order("updated_at", { ascending: false });
    if (error) throw error;
    ui.site.replaceChildren();
    (sites || []).forEach(site => {
      const option = node("option", "", site.name || "Site sans nom");
      option.value = site.id;
      option.dataset.organizationId = site.organization_id;
      ui.site.appendChild(option);
    });
    if (!sites?.length) return announce("Crée d’abord un site pour pouvoir gérer ses pages.", true);
    const previous = localStorage.getItem("sama_studio_cms_site_v1");
    if (sites.some(s => s.id === previous)) ui.site.value = previous;
    await loadAll();
  } catch (error) { announce(friendly(error), true); }
}
function friendly(error) {
  const message = String(error?.message || error || "Une erreur est survenue.");
  if (/row-level security|permission denied|not authorized/i.test(message)) return "Accès refusé : seuls les propriétaires et administrateurs peuvent modifier ces contenus.";
  if (/relation .* does not exist|schema cache/i.test(message)) return "Le service de pages n’est pas disponible. Vérifie la migration de la base de données.";
  if (/duplicate key|already exists/i.test(message)) return "Cette adresse de page existe déjà sur ce site.";
  return message.slice(0, 300);
}
function selectedSite() { return ui.site.options[ui.site.selectedIndex] || null; }
function selectedOrgId() { return selectedSite()?.dataset.organizationId || ""; }
async function loadAll() {
  const siteId = ui.site.value;
  if (!siteId) return;
  localStorage.setItem("sama_studio_cms_site_v1", siteId);
  clearPageForm();
  await Promise.all([loadPages(), loadMedia(), loadRevisions()]);
}
async function loadPages() {
  const { data, error } = await supabase.from("site_pages")
    .select("id,site_id,organization_id,title,slug,content,seo_title,seo_description,status,menu_order,show_in_menu,updated_at")
    .eq("site_id", ui.site.value).order("menu_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) { announce(friendly(error), true); return; }
  ui.list.replaceChildren();
  (data || []).forEach(page => {
    const card = node("article", "cms-item");
    const copy = node("div", "cms-item-copy");
    copy.append(node("strong", "", page.title), node("small", "", "/" + page.slug + " · " + (page.status === "published" ? "Publiée" : page.status === "archived" ? "Archivée" : "Brouillon")));
    const actions = node("div", "cms-item-actions");
    actions.appendChild(makeButton("Modifier", () => fillPageForm(page), true));
    if (page.status !== "published") actions.appendChild(makeButton("Publier la page", () => setPageStatus(page, "published")));
    else actions.appendChild(makeButton("Mettre en brouillon", () => setPageStatus(page, "draft"), true));
    actions.appendChild(makeButton("Supprimer", () => deletePage(page), true));
    card.append(copy, actions); ui.list.appendChild(card);
  });
  if (!data?.length) ui.list.appendChild(node("p", "cms-muted", "Aucune page créée. Commence par ajouter une page."));
}
function fillPageForm(page) {
  ui.pageId.value = page.id; ui.title.value = page.title || ""; ui.slug.value = page.slug || "";
  ui.seoTitle.value = page.seo_title || ""; ui.seoDescription.value = page.seo_description || "";
  const c = page.content || {};
  ui.content.value = typeof c === "string" ? c : String(c.body || c.content || "");
  ui.visible.checked = page.show_in_menu !== false;
  ui.save.textContent = "Enregistrer la page";
  announce("Modification de « " + page.title + " ».");
}
function clearPageForm() {
  if (!ui.form) return;
  ui.form.reset(); ui.pageId.value = ""; ui.slug.value = ""; ui.save.textContent = "Créer la page";
}
async function savePage(event) {
  event.preventDefault();
  const siteId = ui.site.value, organizationId = selectedOrgId();
  if (!siteId || !organizationId) return announce("Choisis un site.", true);
  const title = ui.title.value.trim(), slug = slugify(ui.slug.value || title);
  if (!title) return announce("Le titre de la page est obligatoire.", true);
  const payload = {
    site_id: siteId, organization_id: organizationId, title, slug,
    content: { body: ui.content.value.trim() },
    seo_title: ui.seoTitle.value.trim().slice(0, 70),
    seo_description: ui.seoDescription.value.trim().slice(0, 170),
    show_in_menu: ui.visible.checked,
    menu_order: Math.max(0, ui.list.children.length - 1),
    status: "draft"
  };
  busy(ui.save, true, "Enregistrement…");
  try {
    let result;
    if (ui.pageId.value) {
      result = await supabase.from("site_pages").update(payload).eq("id", ui.pageId.value).eq("site_id", siteId).select("id").single();
    } else {
      result = await supabase.from("site_pages").insert(payload).select("id").single();
    }
    if (result.error) throw result.error;
    announce("Page enregistrée en brouillon. Publie cette page puis republie le site pour la rendre accessible sur son URL.");
    clearPageForm(); await loadPages();
  } catch (error) { announce(friendly(error), true); }
  finally { busy(ui.save, false); }
}
async function setPageStatus(page, status) {
  const result = await supabase.from("site_pages").update({ status, published_at: status === "published" ? new Date().toISOString() : null })
    .eq("id", page.id).eq("site_id", ui.site.value);
  if (result.error) return announce(friendly(result.error), true);
  announce(status === "published" ? "Page publiée dans le CMS. Republie le site pour mettre à jour les pages accessibles au public." : "Page remise en brouillon.");
  await loadPages();
}
async function deletePage(page) {
  if (!confirm("Supprimer la page « " + page.title + " » ? Cette action est définitive.")) return;
  const { error } = await supabase.from("site_pages").delete().eq("id", page.id).eq("site_id", ui.site.value);
  if (error) return announce(friendly(error), true);
  announce("Page supprimée."); await loadPages();
}
async function uploadMedia(event) {
  const files = [...(event.target.files || [])]; event.target.value = "";
  const siteId = ui.site.value, orgId = selectedOrgId();
  if (!siteId || !orgId || !files.length) return;
  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(file.type)) {
      announce("Format refusé pour " + file.name + ". Utilise PNG, JPEG, WebP, GIF ou AVIF.", true); continue;
    }
    if (!file.size || file.size > 20 * 1024 * 1024) {
      announce("L’image " + file.name + " dépasse la limite de 20 Mo.", true); continue;
    }
    const path = orgId + "/" + siteId + "/" + crypto.randomUUID() + "-" + file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    announce("Import de " + file.name + "…");
    const uploaded = await supabase.storage.from("site-media").upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) { announce(friendly(uploaded.error), true); continue; }
    const { error } = await supabase.from("site_media_assets").insert({
      site_id: siteId, organization_id: orgId, storage_path: path, original_name: file.name.slice(0, 255),
      mime_type: file.type, byte_size: file.size, alt_text: ""
    });
    if (error) {
      await supabase.storage.from("site-media").remove([path]);
      announce(friendly(error), true); continue;
    }
  }
  await loadMedia();
  announce("Import terminé. Les images restent privées et sont accessibles aux personnes autorisées.");
}
async function loadMedia() {
  const { data, error } = await supabase.from("site_media_assets").select("id,storage_path,original_name,mime_type,byte_size,alt_text,created_at")
    .eq("site_id", ui.site.value).order("created_at", { ascending: false });
  if (error) throw announce(friendly(error), true);
  ui.mediaList.replaceChildren();
  for (const asset of data || []) {
    const signed = await supabase.storage.from("site-media").createSignedUrl(asset.storage_path, 3600);
    const card = node("article", "cms-media-card");
    if (!signed.error && signed.data?.signedUrl) { const image = node("img"); image.src = signed.data.signedUrl; image.alt = asset.alt_text || asset.original_name; card.appendChild(image); }
    const copy = node("div", "cms-item-copy"); copy.append(node("strong", "", asset.original_name), node("small", "", Math.round(asset.byte_size / 1024) + " Ko · lien temporaire 1 h"));
    const remove = makeButton("Supprimer", async () => {
      if (!confirm("Supprimer définitivement « " + asset.original_name + " » ?")) return;
      const deleted = await supabase.storage.from("site-media").remove([asset.storage_path]);
      if (deleted.error) return announce(friendly(deleted.error), true);
      const row = await supabase.from("site_media_assets").delete().eq("id", asset.id).eq("site_id", ui.site.value);
      if (row.error) return announce(friendly(row.error), true);
      await loadMedia(); announce("Image supprimée.");
    }, true);
    card.append(copy, remove); ui.mediaList.appendChild(card);
  }
  if (!data?.length) ui.mediaList.appendChild(node("p", "cms-muted", "Aucune image dans la médiathèque cloud."));
}
async function saveRevision() {
  const siteId = ui.site.value, organizationId = selectedOrgId();
  if (!siteId || !organizationId) return announce("Choisis un site.", true);
  busy(ui.saveRevision, true, "Sauvegarde…");
  try {
    const [{ data: site, error: siteError }, { data: pages, error: pagesError }] = await Promise.all([
      supabase.from("sites").select("id,name,html_content,organization_id").eq("id", siteId).single(),
      supabase.from("site_pages").select("*").eq("site_id", siteId)
    ]);
    if (siteError) throw siteError; if (pagesError) throw pagesError;
    const { error } = await supabase.from("site_revisions").insert({
      site_id: siteId, organization_id: organizationId,
      label: (ui.revisionLabel.value.trim() || "Version sauvegardée").slice(0, 120),
      snapshot: { html_content: site.html_content, name: site.name, pages: pages || [], saved_at: new Date().toISOString() }
    });
    if (error) throw error;
    ui.revisionLabel.value = ""; announce("Version sauvegardée dans le cloud.");
    await loadRevisions();
  } catch (error) { announce(friendly(error), true); }
  finally { busy(ui.saveRevision, false); }
}
async function loadRevisions() {
  const { data, error } = await supabase.from("site_revisions").select("id,label,created_at,snapshot")
    .eq("site_id", ui.site.value).order("created_at", { ascending: false }).limit(20);
  if (error) throw announce(friendly(error), true);
  ui.revisionList.replaceChildren();
  (data || []).forEach(revision => {
    const copy = node("div", "cms-item-copy");
    copy.append(node("strong", "", revision.label), node("small", "", new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.created_at))));
    const row = node("article", "cms-item");
    row.append(copy, makeButton("Restaurer", () => restoreRevision(revision), true));
    ui.revisionList.appendChild(row);
  });
  if (!data?.length) ui.revisionList.appendChild(node("p", "cms-muted", "Aucune version sauvegardée."));
}
async function restoreRevision(revision) {
  if (!confirm("Restaurer « " + revision.label + " » ? Le contenu actuel sera remplacé.")) return;
  const snap = revision.snapshot || {}, siteId = ui.site.value;
  try {
    if (typeof snap.html_content === "string") {
      const { error } = await supabase.from("sites").update({ html_content: snap.html_content, name: snap.name || undefined })
        .eq("id", siteId).eq("organization_id", selectedOrgId());
      if (error) throw error;
    }
    const prior = snap.pages || [];
    const { data: current, error: readError } = await supabase.from("site_pages").select("id").eq("site_id", siteId);
    if (readError) throw readError;
    const oldIds = (current || []).map(p => p.id), keepIds = prior.map(p => p.id);
    const removeIds = oldIds.filter(id => !keepIds.includes(id));
    if (removeIds.length) {
      const { error } = await supabase.from("site_pages").delete().eq("site_id", siteId).in("id", removeIds);
      if (error) throw error;
    }
    if (prior.length) {
      const { error } = await supabase.from("site_pages").upsert(prior.map(({ created_at, updated_at, created_by, ...p }) => ({ ...p, site_id: siteId, organization_id: selectedOrgId() })), { onConflict: "id" });
      if (error) throw error;
    }
    announce("Version restaurée. Vérifie le contenu avant de demander une nouvelle publication.");
    await loadAll();
  } catch (error) { announce(friendly(error), true); }
}
