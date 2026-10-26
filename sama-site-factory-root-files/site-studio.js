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
    search: ""
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
    const config = currentProject();
    try {
      const drafts = JSON.parse(localStorage.getItem("sama_studio_drafts_v1") || "[]");
      const next = Array.isArray(drafts) ? drafts : [];
      next.unshift(config);
      localStorage.setItem("sama_studio_drafts_v1", JSON.stringify(next.slice(0, 50)));
      localStorage.setItem("sama_studio_last_project_v1", JSON.stringify(config));
      notify("Fiche projet enregistrée dans ce navigateur.");
      $("#projectCount").textContent = config.business.name;
    } catch (error) {
      notify("Le navigateur n’a pas permis l’enregistrement local. Exportez le JSON pour conserver la fiche.");
    }
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
    $("#exportConfigBtn").addEventListener("click", downloadJson);
    $("#copySummaryBtn").addEventListener("click", copySummary);
    $("#resetConfigBtn").addEventListener("click", resetConfiguration);
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
        notify(phone ? `Contact configuré : ${phone}. Cette action sera reliée au site final.` : "Ajoutez un téléphone ou un WhatsApp dans la configuration pour ce projet.");
      } else if (task === "navigation") {
        notify("Navigation de démonstration. Les pages seront reliées lors de l’intégration du modèle.");
      } else {
        notify("Action de démonstration. Cette fonctionnalité sera connectée lors de la création du site client.");
      }
    });
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
  }

  document.addEventListener("DOMContentLoaded", init);
})();
