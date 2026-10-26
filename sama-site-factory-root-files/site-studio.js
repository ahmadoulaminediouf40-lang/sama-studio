/* Sama Studio — preview and client project brief. No server writes in this prototype. */
(function () {
  "use strict";

  const templates = Array.isArray(window.SAMA_SITE_TEMPLATES) ? window.SAMA_SITE_TEMPLATES : [];
  const $ = (selector) => document.querySelector(selector);
  const form = $("#projectForm");
  const preview = $("#storePreview");
  const templateList = $("#templateList");
  const gallery = $("#templateGallery");
  const toast = $("#studioToast");

  const state = {
    templateId: templates[0]?.id || "distribution",
    previewMode: "desktop",
    customIdentity: false,
    toastTimer: null,
    search: "",
    supabase: null,
    user: null,
    authMode: "signin",
    pendingAction: null,
    currentSiteId: null,
    organizationId: null,
    authInitialized: false
  };

  const fields = {
    name: $("#businessName"),
    tagline: $("#businessTagline"),
    city: $("#businessCity"),
    phone: $("#businessPhone"),
    whatsapp: $("#businessWhatsapp"),
    color: $("#brandColor"),
    logo: $("#logoUrl")
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function activeTemplate() {
    return templates.find((template) => template.id === state.templateId) || templates[0];
  }

  function mixHex(hex, target, ratio) {
    const source = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#17633d";
    const dest = /^#[0-9a-f]{6}$/i.test(target || "") ? target : "#ffffff";
    const a = source.match(/[0-9a-f]{2}/gi).map((v) => parseInt(v, 16));
    const b = dest.match(/[0-9a-f]{2}/gi).map((v) => parseInt(v, 16));
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * ratio).toString(16).padStart(2, "0")).join("");
  }

  function currentColor() {
    return /^#[0-9a-f]{6}$/i.test(fields.color.value) ? fields.color.value : activeTemplate().color;
  }

  function currentProject() {
    const template = activeTemplate();
    return {
      schemaVersion: "1.0.0",
      product: "Sama Studio",
      status: "draft",
      template: {
        id: template.id,
        number: template.number,
        name: template.name,
        sector: template.sector,
        layout: template.layout
      },
      business: {
        name: fields.name.value.trim() || template.demoBrand,
        headline: fields.tagline.value.trim() || template.headline,
        city: fields.city.value.trim(),
        phone: fields.phone.value.trim(),
        whatsapp: fields.whatsapp.value.trim(),
        logoUrl: safeUrl(fields.logo.value.trim())
      },
      design: {
        primaryColor: currentColor(),
        secondaryColor: template.soft
      },
      includedCapabilities: template.features.slice(),
      createdAt: new Date().toISOString(),
      note: "Fiche de configuration locale. Le déploiement et la séparation des données clients ne sont pas encore automatisés."
    };
  }

  function textOrDefault(value, fallback) {
    return escapeHtml(String(value || "").trim() || fallback);
  }

  function renderTemplateList(query = "") {
    const normalized = query.trim().toLocaleLowerCase("fr");
    const filtered = templates.filter((template) => `${template.name} ${template.sector} ${template.description}`.toLocaleLowerCase("fr").includes(normalized));
    templateList.innerHTML = filtered.map((template) => `
      <button type="button" class="template-nav-item ${template.id === state.templateId ? "active" : ""}" data-template-id="${escapeHtml(template.id)}" aria-current="${template.id === state.templateId ? "true" : "false"}">
        <span class="template-nav-number">${escapeHtml(template.number)}</span>
        <span class="template-nav-copy"><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.sector)}</small></span>
        <span class="template-nav-arrow" aria-hidden="true">↗</span>
      </button>`).join("");
    if (!filtered.length) {
      templateList.innerHTML = '<p class="empty-search">Aucun modèle ne correspond à cette recherche.</p>';
    }
    templateList.querySelectorAll("[data-template-id]").forEach((button) => {
      button.addEventListener("click", () => selectTemplate(button.dataset.templateId));
    });
  }

  function renderTemplateGallery(query = "") {
    const normalized = query.trim().toLocaleLowerCase("fr");
    const filtered = templates.filter((template) => `${template.name} ${template.sector} ${template.description}`.toLocaleLowerCase("fr").includes(normalized));
    $("#templateResultCount").textContent = `${filtered.length} modèle${filtered.length > 1 ? "s" : ""}`;
    gallery.innerHTML = filtered.map((template) => `
      <button type="button" class="template-gallery-card ${template.id === state.templateId ? "selected" : ""}" data-template-id="${escapeHtml(template.id)}">
        <span class="gallery-card-top"><span class="gallery-number">${escapeHtml(template.number)}</span><span class="gallery-sector">${escapeHtml(template.sector)}</span></span>
        <span class="gallery-card-title">${escapeHtml(template.name)}</span>
        <span class="gallery-card-desc">${escapeHtml(template.description)}</span>
        <span class="gallery-card-action">${template.id === state.templateId ? "Modèle sélectionné" : "Utiliser ce modèle"}<span aria-hidden="true">→</span></span>
      </button>`).join("");
    gallery.querySelectorAll("[data-template-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectTemplate(button.dataset.templateId);
        $("#activeTemplateName").scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
  }

  function selectTemplate(id) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    state.templateId = template.id;
    if (!state.customIdentity) {
      fields.name.value = template.demoBrand;
      fields.tagline.value = template.headline;
      fields.city.value = template.location.split(",")[0] || "Dakar";
      fields.phone.value = "";
      fields.whatsapp.value = "";
      fields.color.value = template.color;
      fields.logo.value = "";
    } else {
      fields.color.value = fields.color.value || template.color;
    }
    renderTemplateList(state.search);
    renderTemplateGallery(state.search);
    updateSelectedTemplateInfo();
    renderPreview();
  }

  function updateSelectedTemplateInfo() {
    const template = activeTemplate();
    $("#activeTemplateName").textContent = template.name;
    $("#activeTemplateSector").textContent = template.sector;
    $("#selectedTemplateTitle").textContent = template.name;
    $("#selectedTemplateDescription").textContent = template.description;
    $("#selectedTemplateGlyph").textContent = template.glyph;
    $("#brandColorValue").textContent = currentColor().toUpperCase();
    $("#projectCount").textContent = fields.name.value.trim() || "Projet de démonstration";
  }

  function renderHeader(template) {
    const name = fields.name.value.trim() || template.demoBrand;
    const logo = safeUrl(fields.logo.value.trim());
    const brandMark = logo
      ? `<img class="store-logo" src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(name)}">`
      : `<span class="store-brand-mark">${escapeHtml(name.charAt(0).toLocaleUpperCase("fr"))}</span>`;
    const nav = template.nav.map((item) => `<a href="#storeMain" data-preview-action="navigation">${escapeHtml(item)}</a>`).join("");
    return `<header class="store-header">
      <a href="#storeMain" class="store-brand" data-preview-action="navigation">${brandMark}<span>${escapeHtml(name)}<small>${escapeHtml(fields.city.value.trim() || "Sénégal")}</small></span></a>
      <nav class="store-nav" aria-label="Navigation de la boutique">${nav}</nav>
      <button type="button" class="store-header-cta" data-preview-action="primary">${escapeHtml(template.cta)} <span aria-hidden="true">↗</span></button>
    </header>`;
  }

  function renderFeatureChips(template) {
    return `<div class="store-feature-chips">${template.features.map((feature, index) => `<span><i>${String(index + 1).padStart(2, "0")}</i>${escapeHtml(feature)}</span>`).join("")}</div>`;
  }

  function renderCardGrid(template, cardMode = "product") {
    return `<div class="store-card-grid ${cardMode === "service" ? "service-card-grid" : ""}">${template.cards.map((card, index) => `
      <article class="store-card ${cardMode === "service" ? "store-service-card" : ""}">
        <div class="store-card-image-wrap"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.title)}" loading="lazy"><span class="store-card-index">0${index + 1}</span></div>
        <div class="store-card-content"><div class="store-card-type">${escapeHtml(card.type)}</div><h3>${escapeHtml(card.title)}</h3><div class="store-card-bottom"><strong>${escapeHtml(card.price)}</strong><button type="button" aria-label="En savoir plus sur ${escapeHtml(card.title)}" data-preview-action="card">↗</button></div></div>
      </article>`).join("")}</div>`;
  }

  function renderCatalog(template, headline, body) {
    return `<section class="catalog-hero store-section-pad"><div class="catalog-hero-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><div class="store-hero-actions"><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>→</span></button><button type="button" class="store-quiet-btn" data-preview-action="secondary">${escapeHtml(template.secondaryCta)}</button></div><div class="catalog-hero-meta"><span><b>01</b> Un catalogue clair</span><span><b>02</b> Une commande simple</span></div></div><div class="catalog-hero-visual"><img src="${escapeHtml(template.heroImage)}" alt="Produits et univers ${escapeHtml(template.sector)}"><div class="floating-note"><span class="note-spark">✳</span><strong>Les essentiels</strong><small>Choisis pour vous</small></div></div></section><section id="storeMain" class="store-products-section store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">LA SÉLECTION</span><h2>Nos incontournables</h2></div><button type="button" class="store-link-btn" data-preview-action="catalog">Voir tout le catalogue ↗</button></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderFashion(template, headline, body) {
    return `<section class="editorial-hero" style="--editorial-image:url('${escapeHtml(template.heroImage)}')"><div class="editorial-overlay"></div><div class="editorial-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><button type="button" class="store-light-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>↗</span></button><div class="editorial-caption"><span>01 / COLLECTION</span><span>STYLE · IDENTITÉ · SAVOIR-FAIRE</span></div></div></section><section id="storeMain" class="editorial-collection store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">CHOISIR SON STYLE</span><h2>La sélection du moment</h2></div><p class="section-intro">Des pièces choisies pour composer un style qui vous appartient.</p></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderBeauty(template, headline, body) {
    return `<section class="beauty-hero store-section-pad"><div class="beauty-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>→</span></button><div class="beauty-quote">« Prendre soin de soi commence par de bons gestes. »</div></div><div class="beauty-visual"><div class="beauty-halo"></div><img src="${escapeHtml(template.heroImage)}" alt="Univers beauté et soins"><span class="beauty-sticker">RITUEL<br>DOUCEUR</span></div></section><section id="storeMain" class="beauty-routines store-section-pad"><div class="store-section-heading centered-heading"><div><span class="store-eyebrow">VOTRE RITUEL</span><h2>Des soins à chaque étape</h2></div><p class="section-intro">Composez une routine qui répond à vos envies et aux besoins de votre peau.</p></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderElectronics(template, headline, body) {
    return `<section class="tech-hero store-section-pad"><div class="tech-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><div class="store-hero-actions"><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>↗</span></button><button type="button" class="store-quiet-btn" data-preview-action="secondary">${escapeHtml(template.secondaryCta)}</button></div><div class="tech-trust-row"><span><b>✓</b> Informations claires</span><span><b>✓</b> Disponibilité précisée</span></div></div><div class="tech-visual"><img src="${escapeHtml(template.heroImage)}" alt="Équipements électroniques"><div class="tech-float-card"><span>LA SÉLECTION TECH</span><strong>Les bons outils pour vos projets.</strong><small>Conseil · Équipement · Assistance</small></div></div></section><section class="tech-category-strip"><span>SMARTPHONES</span><span>INFORMATIQUE</span><span>AUDIO</span><span>ACCESSOIRES</span></section><section id="storeMain" class="tech-products store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">À DÉCOUVRIR</span><h2>Les produits recherchés</h2></div><span class="tech-label">SÉLECTION · ${escapeHtml(template.sector.toUpperCase())}</span></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderHome(template, headline, body) {
    return `<section class="home-hero store-section-pad"><div class="home-hero-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>↗</span></button><div class="home-note"><span>MATIÈRES NATURELLES</span><span>PIÈCES CHOISIES</span><span>UN INTÉRIEUR VIVANT</span></div></div><div class="home-hero-photo"><img src="${escapeHtml(template.heroImage)}" alt="Intérieur et mobilier"><span class="home-photo-caption">L’art de se sentir chez soi.</span></div></section><section id="storeMain" class="home-gallery store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">LES UNIVERS</span><h2>Imaginer votre espace</h2></div><p class="section-intro">De belles matières, des lignes simples et des idées pour chaque pièce.</p></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderGrocery(template, headline, body) {
    return `<section class="grocery-hero store-section-pad"><div class="grocery-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>→</span></button><div class="grocery-benefits"><span>✓ Produits du quotidien</span><span>✓ Paniers pratiques</span></div></div><div class="grocery-photo"><img src="${escapeHtml(template.heroImage)}" alt="Marché de produits frais"><div class="grocery-stamp">BON<br>ET LOCAL</div></div></section><section id="storeMain" class="grocery-products store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">LE MARCHÉ DU MOMENT</span><h2>À mettre dans votre panier</h2></div><span class="grocery-tag">FRAIS · LOCAL · PRATIQUE</span></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderRestaurant(template, headline, body) {
    return `<section class="restaurant-hero" style="--restaurant-image:url('${escapeHtml(template.heroImage)}')"><div class="restaurant-overlay"></div><div class="restaurant-hero-content"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><div class="restaurant-cta-row"><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>↗</span></button><span class="open-pill"><i></i> Commandes selon horaires</span></div><div class="restaurant-bottom-line"><span>FAIT MAISON</span><span>·</span><span>INSPIRÉ DU TERROIR</span><span>·</span><span>À PARTAGER</span></div></div></section><section id="storeMain" class="restaurant-menu store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">LA CARTE</span><h2>Nos plats signatures</h2></div><button type="button" class="store-link-btn" data-preview-action="catalog">Consulter la carte complète ↗</button></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderBakery(template, headline, body) {
    return `<section class="bakery-hero store-section-pad"><div class="bakery-visual"><img src="${escapeHtml(template.heroImage)}" alt="Pains et pâtisseries"><span class="bakery-roundel">FAIT<br>AVEC<br>AMOUR</span></div><div class="bakery-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>→</span></button><button type="button" class="bakery-quiet-link" data-preview-action="secondary">${escapeHtml(template.secondaryCta)} ↗</button><div class="bakery-opening"><span>COMMANDES ANTICIPÉES</span><strong>Pains · Pâtisseries · Événements</strong></div></div></section><section id="storeMain" class="bakery-menu store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">DU FOUR À LA TABLE</span><h2>Les douceurs du moment</h2></div><p class="section-intro">Pensez à réserver vos créations pour les dates importantes.</p></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderServices(template, headline, body) {
    return `<section class="services-hero store-section-pad"><div class="services-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><div class="store-hero-actions"><button type="button" class="store-primary-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>↗</span></button><button type="button" class="store-quiet-btn" data-preview-action="secondary">${escapeHtml(template.secondaryCta)}</button></div><div class="services-proof"><strong>UN CONTACT UNIQUE</strong><span>Évaluation · Proposition · Intervention</span></div></div><div class="services-visual"><img src="${escapeHtml(template.heroImage)}" alt="Espace de travail professionnel"><div class="services-stat-card"><strong>Un service organisé</strong><span>Des prestations adaptées à votre besoin.</span></div></div></section><section id="storeMain" class="services-offers store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">NOS PRESTATIONS</span><h2>Comment pouvons-nous vous aider ?</h2></div><span class="service-caption">PROFESSIONNELS · PARTICULIERS</span></div>${renderCardGrid(template, "service")}<div class="services-process">${template.features.map((feature, i) => `<div><span>0${i + 1}</span><strong>${escapeHtml(feature)}</strong></div>`).join("")}</div></section>`;
  }

  function renderRealEstate(template, headline, body) {
    return `<section class="realestate-hero" style="--property-image:url('${escapeHtml(template.heroImage)}')"><div class="realestate-shade"></div><div class="realestate-copy"><span class="store-eyebrow">${escapeHtml(template.eyebrow)}</span><h1>${headline}</h1><p>${body}</p><button type="button" class="store-light-btn" data-preview-action="primary">${escapeHtml(template.cta)} <span>↗</span></button></div><div class="property-search"><span><small>JE RECHERCHE</small><strong>À louer ou à acheter</strong></span><span><small>TYPE DE BIEN</small><strong>Appartement, villa…</strong></span><button type="button" data-preview-action="catalog">Voir les biens <span>→</span></button></div></section><section id="storeMain" class="realestate-listings store-section-pad"><div class="store-section-heading"><div><span class="store-eyebrow">BIENS SÉLECTIONNÉS</span><h2>Nos dernières annonces</h2></div><span class="property-count">03 BIENS EN VEDETTE</span></div>${renderCardGrid(template)}${renderFeatureChips(template)}</section>`;
  }

  function renderFooter(template) {
    return `<footer class="store-footer"><div class="store-footer-brand"><span class="store-brand-mark">${escapeHtml((fields.name.value.trim() || template.demoBrand).charAt(0).toLocaleUpperCase("fr"))}</span><span><strong>${escapeHtml(fields.name.value.trim() || template.demoBrand)}</strong><small>${escapeHtml(fields.city.value.trim() || "Sénégal")}</small></span></div><p>${escapeHtml(template.tagline)}</p><button type="button" class="store-footer-contact" data-preview-action="contact">Contact & renseignements ↗</button><div class="store-footer-bottom"><span>APERÇU DE DÉMONSTRATION</span><span>Configuration adaptée au projet client</span></div></footer>`;
  }

  function renderPreview() {
    const template = activeTemplate();
    if (!template) return;
    const brandColor = currentColor();
    const softColor = mixHex(brandColor, "#ffffff", 0.90);
    const darkColor = mixHex(brandColor, "#08111b", 0.58);
    const headline = textOrDefault(fields.tagline.value, template.headline);
    const body = escapeHtml(template.body);
    const renderer = {
      catalog: renderCatalog,
      editorial: renderFashion,
      beauty: renderBeauty,
      electronics: renderElectronics,
      home: renderHome,
      grocery: renderGrocery,
      restaurant: renderRestaurant,
      bakery: renderBakery,
      services: renderServices,
      realestate: renderRealEstate
    }[template.layout];
    const content = renderer ? renderer(template, headline, body) : renderCatalog(template, headline, body);
    preview.className = `store-preview preview-${state.previewMode}`;
    preview.innerHTML = `<div class="preview-site layout-${escapeHtml(template.layout)} template-${escapeHtml(template.id)}" style="--brand:${brandColor};--brand-soft:${softColor};--brand-dark:${darkColor}">${renderHeader(template)}<main id="storeMainRoot" class="store-main">${content}</main>${renderFooter(template)}</div>`;
    preview.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", () => {
        image.classList.add("image-unavailable");
        image.alt = image.alt || "Image de démonstration non disponible";
      }, { once: true });
    });
    updateSelectedTemplateInfo();
    updateDeviceButtons();
  }

  function updateDeviceButtons() {
    const isMobile = state.previewMode === "mobile";
    $("#desktopPreviewBtn").classList.toggle("active", !isMobile);
    $("#mobilePreviewBtn").classList.toggle("active", isMobile);
    $("#desktopPreviewBtn").setAttribute("aria-pressed", String(!isMobile));
    $("#mobilePreviewBtn").setAttribute("aria-pressed", String(isMobile));
  }

  function setPreviewMode(mode) {
    state.previewMode = mode === "mobile" ? "mobile" : "desktop";
    renderPreview();
  }

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3000);
  }

  function saveProject(event) {
    if (event) event.preventDefault();
    const submit = window.SAMA_PUBLISHER?.submitForReview;
    if (typeof submit === "function") submit();
    else notify("Le créateur se prépare. Réessaie dans quelques instants.");
  }

  function downloadJson() {
    const config = currentProject();
    const slug = (config.business.name || "projet").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projet";
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sama-studio-${slug}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("Configuration JSON exportée.");
  }

  async function copySummary() {
    const config = currentProject();
    const summary = [
      `Projet : ${config.business.name}`,
      `Activité : ${config.template.name}`,
      `Ville : ${config.business.city || "À préciser"}`,
      `Téléphone : ${config.business.phone || "À préciser"}`,
      `WhatsApp : ${config.business.whatsapp || "À préciser"}`,
      `Couleur : ${config.design.primaryColor}`,
      `Phrase d’accueil : ${config.business.headline}`,
      `Fonctionnalités prévues : ${config.includedCapabilities.join(", ")}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      notify("Résumé du projet copié.");
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = summary;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      textArea.remove();
      notify(copied ? "Résumé du projet copié." : "Copie impossible ici. Exportez la configuration JSON.");
    }
  }

  function resetConfiguration() {
    state.customIdentity = false;
    const template = activeTemplate();
    fields.name.value = template.demoBrand;
    fields.tagline.value = template.headline;
    fields.city.value = template.location.split(",")[0] || "Dakar";
    fields.phone.value = "";
    fields.whatsapp.value = "";
    fields.color.value = template.color;
    fields.logo.value = "";
    renderPreview();
    notify("Configuration réinitialisée pour ce modèle.");
  }

  function bindForm() {
    Object.values(fields).forEach((field) => {
      field.addEventListener("input", () => {
        state.customIdentity = true;
        renderPreview();
      });
      field.addEventListener("change", () => {
        state.customIdentity = true;
        renderPreview();
      });
    });
    form.addEventListener("submit", saveProject);
    $("#copySummaryBtn").addEventListener("click", copySummary);
    $("#resetConfigBtn").addEventListener("click", resetConfiguration);
    $("#previewFromFormBtn")?.addEventListener("click", renderPreview);
    $("#submitForReviewBtn")?.addEventListener("click", () => {
      if (typeof window.SAMA_PUBLISHER?.submitForReview === "function") window.SAMA_PUBLISHER.submitForReview();
      else notify("Le créateur se prépare. Réessaie dans quelques instants.");
    });
    $("#studioAccountBtn")?.addEventListener("click", () => openAuthGate());
    $("#authGateSignInTab")?.addEventListener("click", () => setAuthMode("signin"));
    $("#authGateSignUpTab")?.addEventListener("click", () => setAuthMode("signup"));
    $("#authGateSwitch")?.addEventListener("click", () => setAuthMode(state.authMode === "signin" ? "signup" : "signin"));
    $("#authGateForm")?.addEventListener("submit", handleAuthSubmit);
    Array.from(document.querySelectorAll("[data-auth-close]")).forEach(button => button.addEventListener("click", closeAuthGate));
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeAuthGate(); });
    $("#desktopPreviewBtn").addEventListener("click", () => setPreviewMode("desktop"));
    $("#mobilePreviewBtn").addEventListener("click", () => setPreviewMode("mobile"));
    $("#templateSearch").addEventListener("input", (event) => {
      state.search = event.target.value;
      renderTemplateList(state.search);
      renderTemplateGallery(state.search);
    });
    preview.addEventListener("click", (event) => {
      const action = event.target.closest("[data-preview-action]");
      if (!action) return;
      event.preventDefault();
      const task = action.dataset.previewAction;
      if (task === "contact") {
        const phone = fields.whatsapp.value.trim() || fields.phone.value.trim();
        notify(phone ? `Contact configuré : ${phone}.` : "Ajoutez un téléphone ou un WhatsApp pour votre site.");
      } else if (task === "navigation") {
        notify("La navigation du site final sera générée à partir du modèle choisi.");
      } else {
        notify("Cette action sera activée sur votre site après validation.");
      }
    });
  }

  function authMessage(message, error) {
    const el = $("#authGateMessage");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", Boolean(error));
  }

  function setAuthMode(mode) {
    state.authMode = mode === "signup" ? "signup" : "signin";
    const signup = state.authMode === "signup";
    $("#authGateTitle").textContent = signup ? "Créez votre compte pour continuer." : "Connectez-vous pour enregistrer votre site.";
    $("#authGateDescription").textContent = signup
      ? "Votre compte vous permettra de sauvegarder le site et de suivre sa validation."
      : "Retrouvez votre espace et reprenez votre projet là où vous en étiez.";
    $("#authGateNameWrap").hidden = !signup;
    $("#authGateName").required = signup;
    $("#authGatePassword").autocomplete = signup ? "new-password" : "current-password";
    $("#authGatePassword").minLength = 8;
    $("#authGateSubmit").textContent = signup ? "Créer mon compte" : "Se connecter";
    $("#authGateSignInTab").classList.toggle("active", !signup);
    $("#authGateSignUpTab").classList.toggle("active", signup);
    $("#authGateSwitch").textContent = signup ? "Vous avez déjà un compte ? Connectez-vous" : "Nouveau sur Sama Studio ? Créez un compte";
    authMessage("");
  }

  function openAuthGate(action) {
    if (typeof action === "function") state.pendingAction = action;
    if (state.user && state.supabase) {
      const pending = state.pendingAction;
      state.pendingAction = null;
      if (pending) pending();
      else window.location.href = "./sama-dashboard.html";
      return;
    }
    const gate = $("#authGate");
    if (!gate) return notify("Connectez-vous depuis l’espace de gestion pour enregistrer votre site.");
    gate.hidden = false;
    setAuthMode(state.authMode);
    window.setTimeout(() => $("#authGateEmail")?.focus(), 60);
  }

  function closeAuthGate() {
    const gate = $("#authGate");
    if (gate) gate.hidden = true;
  }

  function updateAuthButton() {
    const button = $("#studioAccountBtn");
    const label = $("#studioAuthState");
    if (state.user) {
      if (label) label.textContent = "Compte connecté";
      if (button) button.textContent = (state.user.email || "Mon compte") + " · Connecté";
    } else {
      if (label) label.textContent = "Votre espace de création";
      if (button) button.innerHTML = 'Se connecter <span aria-hidden="true">↗</span>';
    }
  }

  async function initializeAuth() {
    const module = await import("https://esm.sh/@supabase/supabase-js@2");
    const createClient = module.createClient;
    const url = "https://jubrkdxrjvkjdlodslcp.supabase.co";
    const key = "sb_publishable_HqIc0fSxhQ9iDThqFXl55g_SJTEiM5h";
    state.supabase = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;
    state.user = data.session?.user || null;
    state.authInitialized = true;
    state.supabase.auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;
      updateAuthButton();
      // The explicit submit handler consumes the pending action exactly once.
    });
    updateAuthButton();
    window.SAMA_STUDIO = {
      get supabase() { return state.supabase; },
      get user() { return state.user; },
      get currentSiteId() { return state.currentSiteId; },
      set currentSiteId(value) { state.currentSiteId = value; },
      withAuth(action) { if (state.user && state.supabase) return action(); openAuthGate(action); return null; },
      openAuthGate,
      notify,
      saveForReview
    };
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!state.supabase) return authMessage("Connexion en cours. Réessaie dans quelques instants.", true);
    const button = $("#authGateSubmit");
    const email = $("#authGateEmail").value.trim();
    const password = $("#authGatePassword").value;
    const name = $("#authGateName").value.trim();
    const signup = state.authMode === "signup";
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = signup ? "Création du compte…" : "Connexion…";
    authMessage("");
    try {
      if (signup) {
        const { data, error } = await state.supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: new URL("./site-studio.html", window.location.href).href, data: { full_name: name } }
        });
        if (error) throw error;
        if (data.session && data.user) {
          state.user = data.user;
          updateAuthButton();
          closeAuthGate();
          const pending = state.pendingAction;
          state.pendingAction = null;
          if (pending) await pending();
        } else {
          authMessage("Votre compte a été créé. Vérifiez votre boîte e-mail pour confirmer l’adresse, puis revenez vous connecter. Votre configuration reste dans cette page.", false);
        }
      } else {
        const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.user = data.user;
        updateAuthButton();
        closeAuthGate();
        const pending = state.pendingAction;
        state.pendingAction = null;
        if (pending) await pending();
      }
    } catch (error) {
      let message = String(error?.message || error);
      if (/invalid login credentials/i.test(message)) message = "Adresse e-mail ou mot de passe incorrect.";
      else if (/email not confirmed/i.test(message)) message = "Confirmez d’abord votre adresse e-mail depuis le message reçu.";
      else if (/password should be at least/i.test(message)) message = "Choisissez un mot de passe d’au moins 8 caractères.";
      authMessage(message.slice(0, 260), true);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function slugBase(value) {
    return String(value || "site-client").normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 46) || "site-client";
  }

  function priceNumber(value) {
    const matches = String(value || "").replace(/\\u00a0/g, " ").match(/\\d[\\d\\s.,]*/);
    if (!matches) return 0;
    const n = Number(matches[0].replace(/[^0-9]/g, ""));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  async function ensureOrganization(businessName) {
    const { data, error } = await state.supabase.from("organization_memberships")
      .select("organization_id,role,created_at").eq("user_id", state.user.id).order("created_at", { ascending: true });
    if (error) throw error;
    const existing = (data || []).find(item => ["owner", "admin"].includes(item.role));
    if (existing) return existing.organization_id;
    const name = String(businessName || state.user.user_metadata?.full_name || "Mon entreprise Sama Studio").trim().slice(0, 120);
    const { data: orgId, error: createError } = await state.supabase.rpc("create_organization", {
      p_name: name.length >= 2 ? name : "Mon entreprise",
      p_slug: slugBase(name)
    });
    if (createError) throw createError;
    if (!orgId) throw new Error("Impossible de créer votre espace entreprise.");
    return orgId;
  }

  async function saveForReview(data, html) {
    if (!state.user || !state.supabase) throw new Error("Connectez-vous avant d’enregistrer le site.");
    if (!data?.business?.name || data.business.name.toLowerCase() === "votre entreprise") throw new Error("Indiquez le vrai nom de votre entreprise.");
    if (!Array.isArray(data.products) || data.products.length < 1) throw new Error("Ajoutez au moins un produit à votre catalogue.");
    if (data.products.some(product => !String(product.name || "").trim())) throw new Error("Chaque produit doit avoir un nom.");
    if (new TextEncoder().encode(html).length > 2900000) throw new Error("Le contenu du site est trop volumineux. Réduisez la taille de l’image ou les descriptions.");
    const organizationId = await ensureOrganization(data.business.name);
    const htmlBytes = new TextEncoder().encode(html).length;
    const { data: usage, error: usageError } = await state.supabase.rpc("get_organization_usage", { p_organization_id: organizationId });
    if (usageError) throw usageError;
    if (usage) {
      const maxSiteBytes = Number(usage.max_site_html_bytes || 0);
      const maxTotalBytes = Number(usage.max_total_site_html_bytes || 0);
      const maxSites = Number(usage.max_sites || 0);
      const maxProducts = Number(usage.max_products || 0);
      if (maxSiteBytes && htmlBytes > maxSiteBytes) throw new Error("Votre formule " + (usage.plan_name || usage.plan_code) + " autorise " + (maxSiteBytes / 1000000).toFixed(1) + " Mo par site. Réduisez les images ou choisissez une formule supérieure.");
      if (maxSites && Number(usage.site_count || 0) >= maxSites) throw new Error("Votre formule autorise " + maxSites + " site(s). Supprimez un site inutile ou demandez une formule supérieure à SAMA Studio.");
      if (maxTotalBytes && Number(usage.site_html_bytes || 0) + htmlBytes > maxTotalBytes) throw new Error("L’espace de sites de votre formule est presque plein (" + (maxTotalBytes / 1000000).toFixed(1) + " Mo au total). Réduisez le poids des images ou changez de formule.");
      if (maxProducts && Number(usage.product_count || 0) + data.products.length > maxProducts) throw new Error("Votre formule autorise " + maxProducts + " produits au total. Réduisez le catalogue ou demandez une formule supérieure.");
    }
    const slug = slugBase(data.business.name) + "-" + Date.now().toString(36).slice(-5);
    const now = new Date().toISOString();
    const { data: site, error } = await state.supabase.from("sites").insert({
      organization_id: organizationId,
      name: String(data.business.name).trim().slice(0, 120),
      slug,
      template_id: String(data.template?.id || "distribution").slice(0, 80),
      status: "draft",
      review_status: "pending",
      review_note: null,
      submitted_at: now,
      html_content: html,
      created_by: state.user.id
    }).select("id,name,slug,review_status,submitted_at").single();
    if (error) throw error;
    const products = data.products.slice(0, 500).map((product, index) => ({
      organization_id: organizationId,
      site_id: site.id,
      external_ref: String(product.id || ("product-" + (index + 1))).slice(0, 180),
      name: String(product.name || "Produit").trim().slice(0, 180),
      category: String(product.category || "Catalogue").trim().slice(0, 100),
      description: String(product.description || "").slice(0, 1000),
      image_url: safeUrl(product.image || ""),
      price: priceNumber(product.price),
      price_label: String(product.price || "Prix à confirmer").slice(0, 100),
      currency: "XOF",
      stock_quantity: Math.max(0, Math.min(999999, Math.floor(Number(product.stockQuantity) || 0))),
      low_stock_threshold: 5,
      is_active: true,
      is_demo: Boolean(product.isExample)
    }));
    if (products.length) {
      const { error: productsError } = await state.supabase.from("products").insert(products);
      if (productsError) {
        await state.supabase.from("sites").delete().eq("id", site.id);
        throw productsError;
      }
    }
    let emailSent = false;
    try {
      const notification = await state.supabase.functions.invoke("notify-site-review", { body: { site_id: site.id } });
      emailSent = !notification.error && Boolean(notification.data?.sent);
    } catch (notificationError) {
      // The database notification already exists. Email delivery is optional until SMTP/provider secrets are configured.
      emailSent = false;
    }
    state.currentSiteId = site.id;
    $("#projectCount").textContent = site.name;
    $("#projectSavedState").textContent = "Demande envoyée · En attente de validation";
    $("#studioToast").textContent = emailSent
      ? "Site enregistré ! La demande a été envoyée et l’e-mail de notification est parti vers SAMA Studio."
      : "Site enregistré ! La notification apparaît dans le tableau de bord SAMA Studio. L’e-mail automatique reste à configurer.";
    $("#studioToast").classList.add("visible");
    const submitButtons = [$("#submitForReviewBtn"), $("#submitForReviewBottomBtn")].filter(Boolean);
    submitButtons.forEach(button => { button.disabled = true; button.textContent = "Demande envoyée"; });
    return site;
  }

  function init() {
    if (!templates.length || !preview || !form) {
      console.error("Sama Studio : registre de templates ou éléments principaux introuvables.");
      return;
    }
    $("#currentYear").textContent = String(new Date().getFullYear());
    fields.name.value = templates[0].demoBrand;
    fields.tagline.value = templates[0].headline;
    fields.city.value = templates[0].location.split(",")[0] || "Dakar";
    fields.color.value = templates[0].color;
    bindForm();
    renderTemplateList();
    renderTemplateGallery();
    updateSelectedTemplateInfo();
    renderPreview();
    initializeAuth().catch(error => {
      console.error("Sama Studio Auth :", error);
      $("#studioAuthState").textContent = "Connexion indisponible";
      authMessage("La connexion sécurisée n’a pas pu démarrer. Rechargez la page.", true);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
