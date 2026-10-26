/* Sama Studio — génération d'un site client autonome, prêt à héberger. */
(function () {
  "use strict";
  var templates = Array.isArray(window.SAMA_SITE_TEMPLATES) ? window.SAMA_SITE_TEMPLATES : [];
  var state = { templateId: "", products: [], productCounter: 0 };
  var toast = document.getElementById("studioToast");
  var productEditor, releasePanel, extra = {};
  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(value) {
    if (!String(value || "").trim()) return "";
    try { var u = new URL(String(value || "").trim(), window.location.href); return ["https:", "http:"].indexOf(u.protocol) !== -1 ? u.href : ""; }
    catch (error) { return ""; }
  }
  function slug(value) {
    return String(value || "site-client").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site-client";
  }
  function activeTemplate() {
    var label = $("#activeTemplateName");
    var title = label ? label.textContent.trim() : "";
    return templates.find(function (item) { return item.name === title; }) || templates[0] || null;
  }
  function announce(message) {
    if (!toast) return;
    toast.textContent = message; toast.classList.add("visible");
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(function () { toast.classList.remove("visible"); }, 3800);
  }
  function normalizeWhatsapp(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.indexOf("00") === 0) digits = digits.slice(2);
    if (digits.length === 9) digits = "221" + digits;
    return digits;
  }
  function fieldValue(id) { var node = document.getElementById(id); return node ? node.value.trim() : ""; }
  function field(id) { return document.getElementById(id); }
  function create(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }
  function cloneProducts(template) {
    return (template && Array.isArray(template.cards) ? template.cards : []).map(function (card, index) {
      return {
        id: "produit-" + (index + 1), name: card.title || "Produit " + (index + 1),
        category: card.type || template.sector || "Catalogue", price: card.price || "Prix sur demande",
        image: safeUrl(card.image || ""),
        description: (card.type || template.sector || "Produit") + ". Contactez-nous pour confirmer les détails.",
        stockQuantity: 0,
        customized: false
      };
    });
  }
  function getExtraDefaults() {
    return {
      businessAddress: "", businessEmail: "", businessDescription: "",
      businessHours: "Contactez-nous pour connaître les horaires.",
      businessDelivery: "Les modalités de livraison sont confirmées lors de la commande.",
      businessInstagram: "", businessFacebook: ""
    };
  }
  function addExtraFields() {
    var form = $("#projectForm"), anchor = $(".config-note", form);
    if (!form || !anchor) return;
    var holder = create("div", "release-extra-fields");
    holder.innerHTML =
      '<div class="form-section-label"><span>03</span> Coordonnées et livraison</div>' +
      '<label>Adresse ou quartier <span class="optional-label">facultatif</span><input id="businessAddress" name="businessAddress" maxlength="140" placeholder="Ex. Point E, Dakar"></label>' +
      '<label>E-mail professionnel <span class="optional-label">facultatif</span><input id="businessEmail" name="businessEmail" type="email" maxlength="120" placeholder="contact@entreprise.sn"></label>' +
      '<label>Présentation de l’entreprise <span class="optional-label">facultatif</span><textarea id="businessDescription" name="businessDescription" rows="3" maxlength="500" placeholder="Présentez l’entreprise, ses engagements et ses services."></textarea></label>' +
      '<label>Horaires ou disponibilité <input id="businessHours" name="businessHours" maxlength="160" value="Contactez-nous pour connaître les horaires."></label>' +
      '<label>Livraison et retrait <input id="businessDelivery" name="businessDelivery" maxlength="200" value="Les modalités de livraison sont confirmées lors de la commande."></label>' +
      '<label>Instagram <span class="optional-label">facultatif</span><input id="businessInstagram" name="businessInstagram" type="url" maxlength="220" placeholder="https://instagram.com/votrecompte"></label>' +
      '<label>Facebook <span class="optional-label">facultatif</span><input id="businessFacebook" name="businessFacebook" type="url" maxlength="220" placeholder="https://facebook.com/votrepage"></label>';
    form.insertBefore(holder, anchor);
    ["seoTitle", "seoDescription"].forEach(function (id) {
      var input = field(id);
      if (input) { input.addEventListener("input", persistReleaseDraft); input.addEventListener("change", persistReleaseDraft); }
    });
    Object.keys(getExtraDefaults()).forEach(function (id) { extra[id] = field(id); });
  }
  function addReleasePanel() {
    var panel = create("section", "release-panel");
    panel.setAttribute("aria-label", "Enregistrer le site et demander sa validation");
    panel.innerHTML =
      '<div class="release-panel-heading"><div><span class="eyebrow">ÉTAPE 03</span><h2>Enregistrer & faire valider</h2></div><span class="release-pill">100 % en ligne</span></div>' +
      '<p class="release-intro">Votre site sera sauvegardé dans votre compte Sama Studio. Notre équipe le vérifiera avant de l’activer. Aucun fichier HTML à télécharger, aucun hébergement à configurer vous-même.</p>' +
      '<div class="release-capability-row"><span>✓ Aperçu instantané</span><span>✓ Sauvegarde sécurisée</span><span>✓ Validation humaine</span></div>' +
      '<details class="product-editor-details" open><summary><span>Votre catalogue de produits</span><small id="releaseProductCount">3 produits</small></summary>' +
      '<p class="release-help">Remplacez les exemples par vos produits réels. Pour chaque article, renseignez un nom, un prix, une image et une description claire. La capacité du catalogue dépendra de votre formule.</p>' +
      '<div id="siteProductsEditor" class="site-products-editor"></div>' +
      '<button id="addSiteProductBtn" class="btn btn-secondary btn-full" type="button">＋ Ajouter un produit</button></details>' +
      '<div class="release-export-actions"><button id="submitForReviewBottomBtn" class="btn btn-primary btn-full" type="button">Enregistrer et demander validation <span aria-hidden="true">→</span></button>' +
      '<button id="previewWebsiteBtn" class="btn btn-secondary btn-full" type="button">↗ Voir mon aperçu</button></div>' +
      '<div class="release-disclaimer"><strong>Après l’envoi</strong><p>Votre demande apparaît dans votre espace. SAMA Studio vérifie les coordonnées, le catalogue et le rendu, puis approuve le site ou vous indique les corrections à faire. Votre site reste privé jusqu’à sa validation.</p></div>' +
      '<label class="release-confirmation"><input id="releaseChecklistConfirmed" type="checkbox"><span><strong>J’ai vérifié les informations</strong><small>Les prix, produits, coordonnées et images sont exacts et peuvent être utilisés sur mon site.</small></span></label>';
    var config = $(".configuration-panel"), footer = $(".config-footer", config);
    config.insertBefore(panel, footer || null);
    releasePanel = panel; productEditor = $("#siteProductsEditor", panel);
  }
  function productInput(labelText, key, value, index, placeholder) {
    var label = create("label", "product-field", labelText), input;
    if (key === "description") { input = create("textarea"); input.rows = 2; input.maxLength = 350; }
    else { input = create("input"); input.type = key === "image" ? "url" : key === "stockQuantity" ? "number" : "text"; input.maxLength = key === "image" ? 500 : key === "name" ? 90 : 100; if (key === "stockQuantity") { input.min = "0"; input.max = "999999"; input.step = "1"; } }
    input.value = value || ""; input.placeholder = placeholder || "";
    input.dataset.productIndex = String(index); input.dataset.productKey = key;
    input.addEventListener("input", function () {
      var i = Number(input.dataset.productIndex), prop = input.dataset.productKey;
      if (!state.products[i]) return;
      state.products[i][prop] = input.value;
      if (prop !== "stockQuantity") state.products[i].customized = true;
      var confirmation = field("releaseChecklistConfirmed"); if (confirmation) confirmation.checked = false;
      syncPreviewProducts(); persistReleaseDraft();
    });
    label.appendChild(input); return label;
  }
  function renderProductEditor() {
    if (!productEditor) return;
    productEditor.replaceChildren();
    var confirmation = field("releaseChecklistConfirmed"); if (confirmation) confirmation.checked = false;
    state.products.forEach(function (product, index) {
      var card = create("div", "product-edit-card"), top = create("div", "product-edit-card-top");
      top.appendChild(create("strong", "", "Produit " + String(index + 1).padStart(2, "0")));
      var remove = create("button", "product-remove-button", "Supprimer");
      remove.type = "button"; remove.setAttribute("aria-label", "Supprimer " + (product.name || "ce produit"));
      remove.addEventListener("click", function () {
        if (state.products.length <= 1) return announce("Conserve au moins un produit dans le catalogue.");
        state.products.splice(index, 1); renderProductEditor(); syncPreviewProducts(); persistReleaseDraft();
      });
      top.appendChild(remove); card.appendChild(top);
      card.appendChild(productInput("Nom du produit", "name", product.name, index, "Nom affiché au client"));
      var double = create("div", "product-fields-two");
      double.appendChild(productInput("Catégorie", "category", product.category, index, "Ex. Accessoires"));
      double.appendChild(productInput("Prix affiché", "price", product.price, index, "Ex. 12 500 F CFA"));
      card.appendChild(double);
      card.appendChild(productInput("Description", "description", product.description, index, "Détails utiles pour le client"));
      card.appendChild(productInput("URL de l’image", "image", product.image, index, "https://…"));
      card.appendChild(productInput("Disponibilité (unités ou créneaux)", "stockQuantity", String(product.stockQuantity ?? 0), index, "Ex. 25"));
      productEditor.appendChild(card);
    });
    var count = $("#releaseProductCount");
    if (count) count.textContent = state.products.length + " produit" + (state.products.length > 1 ? "s" : "");
  }
  function syncPreviewProducts() {
    var preview = $("#storePreview"), grid = preview && $(".store-card-grid", preview);
    if (!grid) return;
    grid.replaceChildren();
    state.products.forEach(function (product, index) {
      var card = create("article", "store-card"), imageWrap = create("div", "store-card-image-wrap");
      var image = create("img"); image.src = safeUrl(product.image); image.alt = product.name || "Produit"; image.loading = "lazy";
      image.addEventListener("error", function () { image.classList.add("image-unavailable"); }, { once: true });
      imageWrap.appendChild(image); imageWrap.appendChild(create("span", "store-card-index", String(index + 1).padStart(2, "0")));
      var content = create("div", "store-card-content");
      content.appendChild(create("div", "store-card-type", product.category || "Catalogue"));
      content.appendChild(create("h3", "", product.name || "Nouveau produit"));
      var bottom = create("div", "store-card-bottom");
      bottom.appendChild(create("strong", "", product.price || "Prix sur demande"));
      var action = create("button", "", "↗"); action.type = "button"; action.dataset.previewAction = "card";
      action.setAttribute("aria-label", "En savoir plus sur " + (product.name || "ce produit"));
      bottom.appendChild(action); content.appendChild(bottom);
      card.appendChild(imageWrap); card.appendChild(content); grid.appendChild(card);
    });
  }
  function collectData() {
    var template = activeTemplate();
    if (!template) throw new Error("Aucun modèle n’est sélectionné.");
    var name = fieldValue("businessName") || template.demoBrand || "Votre entreprise";
    var tagline = fieldValue("businessTagline") || template.headline || "Bienvenue";
    return {
      schemaVersion: "1.1.0", product: "Sama Studio", status: "draft",
      template: {
        id: template.id, number: template.number, name: template.name, sector: template.sector, layout: template.layout,
        eyebrow: template.eyebrow, heroImage: safeUrl(template.heroImage),
        features: Array.isArray(template.features) ? template.features.slice() : [],
        navigation: Array.isArray(template.nav) ? template.nav.slice() : []
      },
      business: {
        name: name, headline: tagline, city: fieldValue("businessCity"), phone: fieldValue("businessPhone"),
        whatsapp: fieldValue("businessWhatsapp"), email: fieldValue("businessEmail"), address: fieldValue("businessAddress"),
        description: fieldValue("businessDescription") || template.body || "", hours: fieldValue("businessHours"),
        delivery: fieldValue("businessDelivery"), instagram: safeUrl(fieldValue("businessInstagram")),
        facebook: safeUrl(fieldValue("businessFacebook")), logoUrl: safeUrl(fieldValue("logoUrl")),
        seoTitle: fieldValue("seoTitle").slice(0, 70), seoDescription: fieldValue("seoDescription").slice(0, 170)
      },
      design: {
        primaryColor: /^#[0-9a-f]{6}$/i.test(fieldValue("brandColor")) ? fieldValue("brandColor") : template.color,
        secondaryColor: template.soft || "#eef4ef", darkColor: template.dark || "#173b2a"
      },
      includedCapabilities: Array.isArray(template.features) ? template.features.slice() : [],
      products: state.products.map(function (product, index) {
        return {
          id: slug(product.name) + "-" + (index + 1), name: String(product.name || "").trim(),
          category: String(product.category || template.sector || "Catalogue").trim(),
          price: String(product.price || "Prix sur demande").trim(), description: String(product.description || "").trim(),
          image: safeUrl(product.image), stockQuantity: Math.max(0, Math.min(999999, Math.floor(Number(product.stockQuantity) || 0))),
          isExample: !product.customized
        };
      }),
      createdAt: new Date().toISOString(),
      note: "Le fichier HTML exporté est autonome. Le panier utilise le navigateur et les commandes sont envoyées via WhatsApp. Aucun paiement en ligne ni stockage serveur n’est inclus."
    };
  }
  function saveExtendedDraft() {
    try {
      var data = collectData();
      localStorage.setItem("sama_studio_release_draft_v1", JSON.stringify(data));
      var last = localStorage.getItem("sama_studio_last_project_v1"), combined = last ? JSON.parse(last) : {};
      Object.assign(combined, data); localStorage.setItem("sama_studio_last_project_v1", JSON.stringify(combined));
      var drafts = JSON.parse(localStorage.getItem("sama_studio_drafts_v1") || "[]");
      if (!Array.isArray(drafts)) drafts = [];
      if (drafts.length) drafts[0] = Object.assign(drafts[0], data); else drafts.unshift(data);
      localStorage.setItem("sama_studio_drafts_v1", JSON.stringify(drafts.slice(0, 50)));
    } catch (error) { /* L’export reste possible si le stockage local est désactivé. */ }
  }
  function clientCss() {
    return [
      ':root{color-scheme:light;--brand:#17633d;--soft:#e9f5ec;--dark:#153c2c;--ink:#17251e;--muted:#63746a;--line:#e1e9e3;--paper:#fff;--page:#f7f9f6;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif}',
      '*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:84px}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.55 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;-webkit-font-smoothing:antialiased}button,input,select{font:inherit}button,a{touch-action:manipulation}a{color:inherit;text-decoration:none}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #8dbb96;outline-offset:3px}.wrap{width:min(1160px,calc(100% - 40px));margin-inline:auto}.site-header{position:sticky;top:0;z-index:20;background:#ffffffed;backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.header-inner{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:11px;min-width:0}.brand-mark{width:42px;height:42px;border-radius:13px;object-fit:cover;background:var(--brand);color:white;display:grid;place-items:center;font-weight:900;font-size:20px;flex:none}.brand-copy{min-width:0}.brand-copy strong{display:block;font-size:16px;line-height:1.2;overflow-wrap:anywhere}.brand-copy small{display:block;color:var(--muted);font-size:12px;margin-top:4px}.main-nav{display:flex;gap:24px;align-items:center;font-size:13px;color:#506357;font-weight:650}.main-nav a:hover{color:var(--brand)}.header-actions{display:flex;gap:9px;align-items:center}.btn{border:1px solid transparent;border-radius:12px;padding:12px 16px;font-weight:750;font-size:13px;display:inline-flex;justify-content:center;align-items:center;gap:8px;transition:transform .15s,background .15s,border-color .15s}.btn:hover{transform:translateY(-1px)}.btn-primary{background:var(--brand);color:white;box-shadow:0 7px 18px #12351c22}.btn-quiet{background:var(--paper);border-color:var(--line);color:var(--ink)}.cart-count{min-width:21px;height:21px;padding:0 5px;border-radius:99px;background:white;color:var(--brand);display:inline-grid;place-items:center;font-size:11px;font-weight:900}.hero{position:relative;overflow:hidden;background:var(--soft);padding:66px 0 60px}.hero-grid{display:grid;grid-template-columns:1.04fr .96fr;gap:56px;align-items:center}.eyebrow{color:var(--brand);font-size:11px;text-transform:uppercase;font-weight:850;letter-spacing:.15em}.hero h1{font-size:clamp(38px,5vw,66px);line-height:1.02;letter-spacing:-.06em;margin:17px 0 18px;max-width:720px;overflow-wrap:anywhere}.hero p{color:#506357;font-size:17px;line-height:1.75;max-width:560px;margin:0}.hero-actions{display:flex;gap:11px;flex-wrap:wrap;margin-top:26px}.hero-image-wrap{position:relative;min-width:0}.hero-image{display:block;width:100%;height:390px;object-fit:cover;border-radius:30px 8px 30px 8px;box-shadow:0 22px 50px #14251c22;background:#dfe9df}.hero-float{position:absolute;left:-20px;bottom:22px;max-width:80%;border-radius:15px;padding:15px 18px;background:#fff;box-shadow:0 9px 30px #14251c20;font-size:13px;font-weight:800}.trust-strip{background:white;border-bottom:1px solid var(--line)}.trust-inner{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:22px 0}.trust-item{display:flex;align-items:center;gap:11px;color:#465a4d;font-weight:700;font-size:13px}.trust-icon{width:32px;height:32px;background:var(--soft);color:var(--brand);border-radius:10px;display:grid;place-items:center;font-weight:900;flex:none}.section{padding:66px 0}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.section-heading h2{font-size:clamp(27px,3.3vw,40px);line-height:1.1;letter-spacing:-.045em;margin:8px 0 0}.section-heading p{margin:0;color:var(--muted);max-width:440px}.shop-tools{display:flex;gap:10px;align-items:center;margin-bottom:22px}.shop-input,.shop-select{height:46px;border:1px solid var(--line);background:white;border-radius:11px;padding:0 14px;min-width:0;color:var(--ink)}.shop-input{flex:1}.shop-select{min-width:180px}.product-count{font-size:12px;color:var(--muted);white-space:nowrap}.product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:19px}.product-card{overflow:hidden;border:1px solid var(--line);border-radius:17px;background:white;display:flex;flex-direction:column;min-width:0;box-shadow:0 6px 20px #1b35220a;transition:transform .18s,box-shadow .18s}.product-card:hover{transform:translateY(-3px);box-shadow:0 16px 28px #1b352215}.product-photo{position:relative;aspect-ratio:1.18;background:var(--soft);overflow:hidden}.product-photo img{width:100%;height:100%;display:block;object-fit:cover}.product-photo.image-fallback:after{content:"Image à ajouter";position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:12px}.product-category{position:absolute;left:12px;top:12px;border-radius:99px;background:#ffffffed;padding:6px 10px;font-size:10px;font-weight:800;color:var(--dark);max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.product-body{padding:17px;display:flex;flex-direction:column;gap:9px;flex:1}.product-body h3{margin:0;font-size:17px;line-height:1.25;letter-spacing:-.02em;overflow-wrap:anywhere}.product-description{margin:0;color:var(--muted);font-size:13px;line-height:1.6;flex:1}.product-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px}.price{font-weight:850;color:var(--brand);overflow-wrap:anywhere}.add-cart{width:40px;height:40px;border:0;border-radius:12px;background:var(--brand);color:white;font-size:22px;flex:none}.empty-products{padding:28px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);text-align:center;grid-column:1/-1}.about-panel{border-radius:24px;background:white;border:1px solid var(--line);padding:30px;display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:start}.about-panel h2{margin:8px 0 12px;font-size:30px;line-height:1.12;letter-spacing:-.04em}.about-panel p{color:var(--muted);margin:0;white-space:pre-line}.feature-list{display:grid;gap:10px}.feature-row{display:flex;align-items:start;gap:10px;padding:12px;border-radius:12px;background:var(--page);font-size:13px;font-weight:700}.feature-check{color:var(--brand);font-weight:900}.contact-section{background:var(--dark);color:white}.contact-section .eyebrow{color:#b7dfbd}.contact-section .section-heading p{color:#d0ddd3}.contact-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.contact-card{padding:20px;border-radius:15px;border:1px solid #ffffff24;background:#ffffff0c;min-width:0}.contact-card small{display:block;color:#b8cbbd;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.11em}.contact-card strong,.contact-card a{display:block;margin-top:7px;font-size:16px;overflow-wrap:anywhere}.contact-card a:hover{text-decoration:underline}.social-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.social-links a{border:1px solid #ffffff50;border-radius:99px;padding:9px 13px;font-size:12px;font-weight:750}.site-footer{background:#10271b;color:#b7c8bb;padding:22px 0;font-size:12px}.footer-inner{display:flex;align-items:center;justify-content:space-between;gap:18px}.footer-inner strong{color:white}.footer-note{max-width:600px;text-align:right}.backdrop{position:fixed;inset:0;background:#09140e82;z-index:50;opacity:0;pointer-events:none;transition:opacity .2s}.backdrop.open{opacity:1;pointer-events:auto}.cart-drawer{position:fixed;z-index:51;right:0;top:0;height:100dvh;width:min(440px,100%);padding:23px;background:white;box-shadow:-20px 0 60px #0a1e1240;transform:translateX(105%);transition:transform .25s;display:flex;flex-direction:column;gap:17px}.cart-drawer.open{transform:translateX(0)}.drawer-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.drawer-head h2{margin:0;font-size:23px}.icon-button{width:38px;height:38px;border:1px solid var(--line);border-radius:11px;background:white;font-size:20px}.cart-lines{display:grid;gap:10px;overflow:auto;flex:1;align-content:start}.product-stock-badge{position:absolute;right:10px;bottom:10px;z-index:2;padding:6px 8px;border-radius:999px;background:#ffffffed;color:#416c41;font-size:9px;font-weight:850;box-shadow:0 3px 8px #14251c0d}.product-stock-badge.out-of-stock{background:#fff0ef;color:#9c4943}.product-stock-badge.low-stock{background:#fff3de;color:#93611f}.add-cart:disabled{opacity:.38;cursor:not-allowed;transform:none!important}.product-card:has(.add-cart:disabled){filter:saturate(.85)}.cart-line{display:grid;grid-template-columns:48px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.cart-product-thumb{display:block;width:48px;height:48px;border-radius:10px;object-fit:cover;background:var(--soft);flex:none}.cart-product-thumb-fallback{display:grid;place-items:center;color:var(--brand);font-weight:900;font-size:16px}.cart-line-info{min-width:0}.cart-line strong{display:block;overflow-wrap:anywhere}.cart-line small{display:block;color:var(--muted);margin-top:3px;overflow-wrap:anywhere}.cart-line .cart-line-total{font-size:11px;font-weight:800;color:var(--brand)}.qty-controls{display:flex;align-items:center;gap:6px}.qty-controls button,.qty-controls .qty-value{width:29px;height:29px;display:grid;place-items:center;border-radius:9px;border:1px solid var(--line);background:white;font-weight:800}.qty-controls button:disabled{opacity:.35;cursor:not-allowed}.cart-remove{width:29px;height:29px;display:grid;place-items:center;color:#9c554f}.cart-subtotal-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 0 10px;font-size:12px;color:var(--muted)}.cart-subtotal-row strong{color:var(--brand);font-size:16px}.cart-total .cart-totals-note{display:block;padding:9px 10px;border-radius:9px;background:var(--page);font-size:10px;margin-bottom:12px}.cart-total{border-top:1px solid var(--line);padding-top:15px}.cart-total small{display:block;color:var(--muted);line-height:1.5;margin-bottom:10px}.full-width{width:100%}.toast{position:fixed;z-index:70;left:50%;bottom:20px;transform:translate(-50%,20px);opacity:0;pointer-events:none;background:#142d1d;color:white;border-radius:12px;padding:12px 17px;box-shadow:0 10px 30px #0003;max-width:calc(100% - 30px);text-align:center;font-size:13px;transition:opacity .2s,transform .2s}.toast.visible{opacity:1;transform:translate(-50%,0)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.layout-editorial .hero{background:#211e1d;color:white}.layout-editorial .hero p{color:#e5ddda}.layout-editorial .hero .eyebrow{color:#e7b5a4}.layout-electronics .hero{background:#101b2d;color:white}.layout-electronics .hero p{color:#ccd5e2}.layout-electronics .hero .eyebrow{color:#9bbcff}.layout-realestate .hero{background:#153746;color:white}.layout-realestate .hero p{color:#dae6e8}.layout-realestate .hero .eyebrow{color:#f0d39a}.layout-restaurant .hero{background:#2b1b15;color:white}.layout-restaurant .hero p{color:#f1ddd1}.layout-restaurant .hero .eyebrow{color:#f2b08c}.layout-beauty .hero,.layout-bakery .hero{background:var(--soft)}body[data-layout=editorial] .hero-image{border-radius:10px 80px 10px 80px}body[data-layout=realestate] .hero-image{border-radius:10px}body[data-layout=restaurant] .hero-image{border-radius:50% 8px 50% 8px}@media(max-width:850px){.wrap{width:min(100% - 28px,640px)}.header-inner{min-height:67px}.main-nav{display:none}.hero{padding:42px 0}.hero-grid{grid-template-columns:1fr;gap:30px}.hero h1{font-size:clamp(38px,10vw,55px)}.hero p{font-size:15px}.hero-image{height:280px}.hero-float{left:10px;bottom:12px}.trust-inner{grid-template-columns:1fr;gap:12px;padding:16px 0}.section{padding:44px 0}.section-heading{display:block}.section-heading p{margin-top:12px}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.product-body{padding:12px}.product-body h3{font-size:14px}.product-description{font-size:12px}.product-bottom{align-items:center}.add-cart{width:36px;height:36px}.about-panel{grid-template-columns:1fr;padding:22px}.contact-grid{grid-template-columns:1fr;gap:10px}.footer-inner{align-items:flex-start;flex-direction:column}.footer-note{text-align:left}.shop-tools{flex-wrap:wrap}.shop-input{flex-basis:100%}.shop-select{flex:1}.product-count{margin-left:auto}.header-actions .btn{padding:10px 12px}}@media(max-width:480px){.wrap{width:calc(100% - 24px)}.brand-mark{width:36px;height:36px}.brand-copy strong{font-size:13px;max-width:145px}.brand-copy small{font-size:10px}.header-actions{gap:5px}.header-actions .btn{font-size:11px;padding:9px}.hero-image{height:220px;border-radius:20px 6px 20px 6px}.hero-float{font-size:11px;padding:11px}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.product-photo{aspect-ratio:.95}.product-body{padding:10px;gap:7px}.product-body h3{font-size:12px}.product-description{font-size:11px}.price{font-size:12px}.add-cart{height:31px;width:31px;border-radius:9px}.about-panel h2{font-size:25px}.contact-card{padding:16px}.section-heading h2{font-size:28px}.cart-drawer{padding:14px;gap:12px}.cart-line{grid-template-columns:38px minmax(0,1fr) auto;gap:7px}.cart-product-thumb{width:38px;height:38px}.cart-line .cart-remove{grid-column:3;grid-row:1;width:24px;height:24px}.cart-line .qty-controls{grid-column:2/4;justify-content:flex-end}.cart-line .cart-line-info{grid-column:2}.cart-line .cart-remove{align-self:start}.cart-subtotal-row strong{font-size:14px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}'
    ].join("");
  }
  function clientRuntime() {
    "use strict";
    var D = window.SAMA_STORE_DATA, byId = function (id) { return document.getElementById(id); };
    var grid = byId("productGrid"), search = byId("productSearch"), category = byId("categoryFilter");
    var resultCount = byId("productCount"), noProducts = byId("noProducts"), drawer = byId("cartDrawer");
    var backdrop = byId("cartBackdrop"), cartLines = byId("cartLines"), cartCount = byId("cartCount"), cart = {};
    var key = "sama-store-cart-" + String(D.business.name || "boutique").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    var visibleProducts = (D.products || []).slice();
    function el(tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    }
    function safeUrl(value) {
      if (!String(value || "").trim()) return "";
      try { var u = new URL(String(value || ""), window.location.href); return u.protocol === "https:" || u.protocol === "http:" ? u.href : ""; }
      catch (error) { return ""; }
    }
    function normalizedPhone(value) {
      var digits = String(value || "").replace(/\D/g, "");
      if (digits.indexOf("00") === 0) digits = digits.slice(2);
      if (digits.length === 9) digits = "221" + digits;
      return digits;
    }
    function announce(message) {
      var node = byId("siteToast"); node.textContent = message; node.classList.add("visible");
      window.clearTimeout(announce.timer);
      announce.timer = window.setTimeout(function () { node.classList.remove("visible"); }, 3500);
    }
    function openCart() {
      drawer.classList.add("open"); backdrop.classList.add("open"); drawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden"; byId("closeCart").focus();
    }
    function closeCart() {
      drawer.classList.remove("open"); backdrop.classList.remove("open"); drawer.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    function productById(id) { return (D.products || []).find(function (p) { return p.id === id; }); }
    function setImage(img, src, alt) {
      var url = safeUrl(src); img.alt = alt || "";
      if (url) {
        img.src = url;
        img.addEventListener("error", function () {
          img.removeAttribute("src"); img.alt = "Image indisponible";
          if (img.parentElement) img.parentElement.classList.add("image-fallback");
        }, { once: true });
      } else {
        img.alt = "Image non renseignée";
        if (img.parentElement) img.parentElement.classList.add("image-fallback");
      }
    }
    function renderProducts() {
      var query = String(search.value || "").trim().toLocaleLowerCase("fr"), cat = category.value;
      visibleProducts = (D.products || []).filter(function (p) {
        return [p.name, p.category, p.description].join(" ").toLocaleLowerCase("fr").indexOf(query) !== -1 && (!cat || p.category === cat);
      });
      grid.replaceChildren();
      visibleProducts.forEach(function (p) {
        var card = el("article", "product-card"), photo = el("div", "product-photo"), img = el("img");
        var available = productStock(p);
        setImage(img, p.image, p.name); photo.appendChild(img);
        photo.appendChild(el("span", "product-category", p.category || "Catalogue"));
        if (available < 1) photo.appendChild(el("span", "product-stock-badge out-of-stock", "Indisponible"));
        else if (available <= 5) photo.appendChild(el("span", "product-stock-badge low-stock", "Plus que " + available));
        var body = el("div", "product-body");
        body.appendChild(el("h3", "", p.name || "Produit"));
        body.appendChild(el("p", "product-description", p.description || "Contactez-nous pour obtenir plus d’informations."));
        var bottom = el("div", "product-bottom");
        bottom.appendChild(el("strong", "price", p.price || "Prix sur demande"));
        var add = el("button", "add-cart", available > 0 ? "+" : "×"); add.type = "button"; add.dataset.addProduct = p.id;
        add.disabled = available < 1 || Object.keys(cart).length > 0 && (Number(cart[p.id]) || 0) >= Math.min(99, available);
        add.setAttribute("aria-label", available > 0 ? "Ajouter " + (p.name || "ce produit") + " au panier" : (p.name || "Produit") + " indisponible");
        if (available < 1) { add.classList.add("add-cart-disabled"); add.title = "Produit temporairement indisponible"; }
        bottom.appendChild(add); body.appendChild(bottom); card.appendChild(photo); card.appendChild(body); grid.appendChild(card);
      });
      resultCount.textContent = visibleProducts.length + " article" + (visibleProducts.length > 1 ? "s" : "");
      noProducts.hidden = visibleProducts.length > 0;
    }
    function fillCategories() {
      var current = category.value; category.replaceChildren();
      var all = el("option", "", "Toutes les catégories"); all.value = ""; category.appendChild(all);
      var categories = Array.from(new Set((D.products || []).map(function (p) { return p.category || "Catalogue"; }))).sort(function (a, b) { return a.localeCompare(b, "fr"); });
      categories.forEach(function (name) { var option = el("option", "", name); option.value = name; category.appendChild(option); });
      if (categories.indexOf(current) >= 0) category.value = current;
    }
    function persistCart() { try { localStorage.setItem(key, JSON.stringify(cart)); } catch (error) { /* Panier conservé en mémoire. */ } }
    function productStock(product) {
      var value = product && (product.stock_quantity !== undefined ? product.stock_quantity : product.stockQuantity);
      return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    }
    function cartItemCount() {
      return Object.keys(cart).reduce(function (sum, id) {
        var product = productById(id), stock = productStock(product);
        return sum + (product && stock > 0 ? Math.min(Math.max(0, Number(cart[id]) || 0), stock, 99) : 0);
      }, 0);
    }
    function cartPriceValue(product) {
      var source = String(product && (product.price || product.price_label) || "").replace(/\u00a0/g, " ");
      var match = source.match(/\d[\d\s.,]*/);
      if (!match) return null;
      var value = Number(match[0].replace(/[^0-9]/g, ""));
      return Number.isFinite(value) ? Math.max(0, value) : null;
    }
    function cartMoney(value) {
      try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: D.business.currency || "XOF", maximumFractionDigits: 0 }).format(Number(value) || 0); }
      catch (error) { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value) || 0) + " " + (D.business.currency || "XOF"); }
    }
    function renderCart() {
      cartLines.replaceChildren();
      Object.keys(cart).forEach(function (id) {
        var product = productById(id), stock = productStock(product);
        if (!product || stock < 1 || (Number(cart[id]) || 0) < 1) delete cart[id];
        else cart[id] = Math.min(99, stock, Math.max(1, Math.floor(Number(cart[id]) || 1)));
      });
      var entries = Object.keys(cart).map(function (id) { return { product: productById(id), quantity: Number(cart[id]) || 0 }; })
        .filter(function (entry) { return entry.product && entry.quantity > 0; });
      var unpriced = false;
      entries.forEach(function (entry) {
        var product = entry.product, quantity = Math.min(99, Math.max(1, entry.quantity));
        cart[product.id] = quantity;
        var price = cartPriceValue(product);
        if (price === null) unpriced = true;
        var line = el("div", "cart-line"), info = el("div", "cart-line-info"), controls = el("div", "qty-controls");
        if (product.image && safeUrl(product.image)) {
          var thumb = el("img", "cart-product-thumb"); setImage(thumb, product.image, product.name || "Produit"); thumb.loading = "lazy"; line.appendChild(thumb);
        } else line.appendChild(el("span", "cart-product-thumb cart-product-thumb-fallback", String(product.name || "P").trim().charAt(0).toUpperCase()));
        info.appendChild(el("strong", "", product.name));
        info.appendChild(el("small", "", product.price || "Prix à confirmer"));
        if (price !== null) info.appendChild(el("small", "cart-line-total", "Sous-total : " + cartMoney(price * quantity)));
        var minus = el("button", "qty-button", "−"); minus.type = "button"; minus.dataset.cartAction = "minus"; minus.dataset.productId = product.id;
        minus.setAttribute("aria-label", "Retirer une unité de " + product.name); minus.disabled = quantity <= 1; controls.appendChild(minus);
        var qty = el("strong", "qty-value", quantity); qty.setAttribute("aria-label", "Quantité"); controls.appendChild(qty);
        var plus = el("button", "qty-button", "+"); plus.type = "button"; plus.dataset.cartAction = "plus"; plus.dataset.productId = product.id;
        plus.setAttribute("aria-label", "Ajouter une unité de " + product.name); plus.disabled = quantity >= 99; controls.appendChild(plus);
        var remove = el("button", "icon-button cart-remove", "×"); remove.type = "button"; remove.dataset.cartAction = "remove"; remove.dataset.productId = product.id;
        remove.setAttribute("aria-label", "Retirer " + product.name + " du panier");
        line.appendChild(info); line.appendChild(controls); line.appendChild(remove); cartLines.appendChild(line);
      });
      if (!entries.length) cartLines.appendChild(el("p", "empty-products cart-empty", "Ton panier est vide. Ajoute un article pour préparer ta commande."));
      cartCount.textContent = String(cartItemCount());
      byId("openCart").setAttribute("aria-label", "Ouvrir le panier (" + cartItemCount() + " article(s))");
      byId("checkoutBtn").disabled = entries.length === 0;
      byId("clearCartBtn").disabled = entries.length === 0;
      var subtotalNode = byId("cartSubtotal");
      var subtotalValue = entries.reduce(function (sum, entry) { var value = cartPriceValue(entry.product); return sum + (value === null ? 0 : value * entry.quantity); }, 0);
      if (subtotalNode) subtotalNode.textContent = entries.length ? (unpriced ? "À confirmer" : cartMoney(subtotalValue)) : cartMoney(0);
      var note = byId("cartTotalsNote");
      if (note) note.textContent = !entries.length
        ? "Le panier est conservé sur cet appareil."
        : (unpriced ? "Le sous-total exclut les articles sans prix affiché. Le vendeur confirmera le montant final." : "Sous-total indicatif, hors livraison. Le vendeur confirmera le prix et la disponibilité.");
      byId("cartSummary").textContent = entries.length ? "Vérifie tes articles puis renseigne ton nom et ton téléphone pour envoyer la commande." : "Ajoute des produits avant de poursuivre.";
      persistCart();
    }
    function addProduct(id) {
      var product = productById(id);
      if (!product) return;
      var stock = productStock(product), current = Number(cart[id]) || 0, limit = Math.min(99, stock);
      if (stock < 1) return announce("Ce produit est actuellement indisponible.");
      if (current >= limit) return announce("La disponibilité maximale pour cet article est de " + limit + " unité(s).");
      cart[id] = current + 1;
      renderCart();
      renderProducts();
      announce("Article ajouté au panier.");
    }
    async function checkout() {
      var entries = Object.keys(cart).map(function (id) {
        var product = productById(id), quantity = Math.max(0, Number(cart[id]) || 0);
        if (!product || quantity < 1) return null;
        var price = cartPriceValue(product);
        return { id: id, product: product, quantity: quantity, price: price };
      }).filter(Boolean);
      if (!entries.length) return announce("Ton panier est vide.");
      var phone = normalizedPhone(D.business.whatsapp || D.business.phone);
      var remote = window.SAMA_STOREFRONT_CONFIG;
      var subtotalValue = entries.reduce(function (sum, entry) { return sum + (entry.price === null ? 0 : entry.price * entry.quantity); }, 0);
      var hasUnpriced = entries.some(function (entry) { return entry.price === null; });
      var message = "Bonjour " + D.business.name + ", je souhaite passer cette commande.\n\nArticles :\n" +
        entries.map(function (entry) {
          var line = "- " + entry.product.name + " × " + entry.quantity;
          if (entry.price === null) line += " — prix à confirmer";
          else line += " — " + cartMoney(entry.price) + " / unité — " + cartMoney(entry.price * entry.quantity);
          return line;
        }).join("\n") +
        "\n\nSous-total indicatif : " + (hasUnpriced ? "à confirmer (" + cartMoney(subtotalValue) + " pour les articles tarifés)" : cartMoney(subtotalValue)) +
        "\nLivraison et disponibilité à confirmer par le vendeur.";
      if (remote && remote.apiUrl && remote.siteSlug && remote.publishableKey) {
        var customerName = String(byId("customerName").value || "").trim();
        var customerPhone = String(byId("customerPhone").value || "").trim();
        var customerAddress = String(byId("customerAddress").value || "").trim();
        var notes = String(byId("customerNotes").value || "").trim();
        if (customerName.length < 1) return announce("Renseigne ton nom pour envoyer la commande.");
        if (customerPhone.replace(/\D/g, "").length < 8) return announce("Renseigne un numéro de téléphone valide.");
        var checkoutButton = byId("checkoutBtn");
        checkoutButton.disabled = true;
        checkoutButton.textContent = "Enregistrement…";
        try {
          var result = await fetch(String(remote.apiUrl).replace(/\/$/, "") + "/functions/v1/create-storefront-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": remote.publishableKey,
              "Authorization": "Bearer " + remote.publishableKey
            },
            body: JSON.stringify({
              site_slug: remote.siteSlug,
              customer_name: customerName,
              customer_phone: customerPhone,
              customer_address: customerAddress,
              notes: notes,
              website: "",
              items: entries.map(function (entry) { return { product_id: entry.id, quantity: entry.quantity }; })
            })
          });
          var payload = {};
          try { payload = await result.json(); } catch (parseError) { payload = {}; }
          if (!result.ok || !payload.accepted || !payload.order) {
            throw new Error(payload.error || "La commande n’a pas été enregistrée. Vérifie la connexion puis réessaie.");
          }
          message += "\n\nRéférence de commande : #" + payload.order.order_number +
            "\nNom : " + customerName + "\nTéléphone : " + customerPhone +
            (customerAddress ? "\nAdresse : " + customerAddress : "") +
            (notes ? "\nNote : " + notes : "") +
            "\n\nMerci de confirmer le montant final et le délai de livraison.";
          cart = {};
          renderCart();
          closeCart();
          if (phone) {
            var whatsappUrl = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
            var popup = window.open(whatsappUrl, "_blank");
            if (popup) popup.opener = null;
            else window.location.href = whatsappUrl;
            announce("Commande #" + payload.order.order_number + " enregistrée. WhatsApp s’ouvre pour finaliser les détails.");
          } else {
            announce("Commande #" + payload.order.order_number + " enregistrée. Le vendeur pourra te recontacter.");
          }
        } catch (error) {
          announce(error && error.message ? error.message : "Impossible d’enregistrer la commande.");
        } finally {
          checkoutButton.disabled = Object.keys(cart).length === 0;
          checkoutButton.textContent = "Envoyer la commande";
        }
        return;
      }
      if (!phone) return announce("Le vendeur n’a pas renseigné de numéro WhatsApp pour les commandes. Contacte-le par e-mail.");
      var nameOnly = String(byId("customerName").value || "").trim();
      var phoneOnly = String(byId("customerPhone").value || "").trim();
      if (!nameOnly || phoneOnly.replace(/\D/g, "").length < 8) {
        return announce("Renseigne ton nom et ton téléphone avant d’ouvrir WhatsApp.");
      }
      message += "\n\nNom : " + nameOnly + "\nTéléphone : " + phoneOnly +
        "\nAdresse : " + String(byId("customerAddress").value || "").trim() +
        "\nNote : " + String(byId("customerNotes").value || "").trim() +
        "\n\nLa commande est à confirmer par le vendeur.";
      var url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
      var win = window.open(url, "_blank");
      if (win) win.opener = null;
      else window.location.href = url;
    }
        function setBusinessContent() {
      var logo = byId("siteLogo");
      if (D.business.logoUrl && safeUrl(D.business.logoUrl)) {
        var img = el("img", "brand-mark"); setImage(img, D.business.logoUrl, "Logo " + D.business.name);
        logo.replaceWith(img); img.id = "siteLogo";
      } else logo.textContent = (D.business.name || "S").trim().charAt(0).toLocaleUpperCase("fr") || "S";
      byId("siteBusinessName").textContent = D.business.name;
      byId("siteCity").textContent = [D.business.city, D.business.address].filter(Boolean).join(" · ") || "Contactez-nous";
      byId("siteHeroTitle").textContent = D.business.headline || "Bienvenue";
      byId("siteHeroDescription").textContent = D.business.description || "Découvrez notre sélection et contactez-nous pour toute information.";
      byId("siteEyebrow").textContent = D.template.eyebrow || D.template.sector || "Bienvenue";
      byId("aboutTitle").textContent = "À propos de " + D.business.name;
      byId("aboutDescription").textContent = D.business.description || "Une entreprise à votre service.";
      byId("siteDelivery").textContent = D.business.delivery || "À confirmer lors de la commande.";
      byId("siteHours").textContent = D.business.hours || "Contactez-nous.";
      byId("siteAddress").textContent = [D.business.address, D.business.city].filter(Boolean).join(", ") || "Adresse sur demande";
      byId("siteFooterName").textContent = D.business.name; byId("siteFooterCity").textContent = D.business.city || "";
      if (D.template.heroImage) setImage(byId("heroImage"), D.template.heroImage, D.template.sector || D.business.name);
      var phone = String(D.business.phone || D.business.whatsapp || "").trim();
      document.querySelectorAll("[data-phone-link]").forEach(function (link) {
        if (phone) { link.href = "tel:" + phone.replace(/[^\d+]/g, ""); link.textContent = phone; }
        else { link.textContent = "Non renseigné"; link.removeAttribute("href"); }
      });
      var wa = normalizedPhone(D.business.whatsapp || D.business.phone);
      document.querySelectorAll("[data-whatsapp-link]").forEach(function (link) {
        if (wa) { link.href = "https://wa.me/" + wa; link.target = "_blank"; link.rel = "noopener noreferrer"; }
        else { link.href = "#contact"; link.removeAttribute("target"); }
      });
      var email = String(D.business.email || "").trim();
      document.querySelectorAll("[data-email-link]").forEach(function (link) {
        if (email) { link.href = "mailto:" + email; link.textContent = email; }
        else { link.textContent = "Non renseigné"; link.removeAttribute("href"); }
      });
      var features = byId("featureList"); features.replaceChildren();
      (D.template.features || []).slice(0, 6).forEach(function (feature) {
        var row = el("div", "feature-row"); row.appendChild(el("span", "feature-check", "✓")); row.appendChild(el("span", "", feature)); features.appendChild(row);
      });
      var socials = byId("socialLinks"); socials.replaceChildren();
      [["Instagram", D.business.instagram], ["Facebook", D.business.facebook]].forEach(function (entry) {
        var url = safeUrl(entry[1]); if (!url) return;
        var link = el("a", "", entry[0]); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; socials.appendChild(link);
      });
      if (!wa) byId("heroWhatsApp").textContent = "Voir le catalogue";
      byId("siteYear").textContent = String(new Date().getFullYear());
    }
    function initialize() {
      document.title = D.business.seoTitle || (D.business.name + " | " + (D.template.sector || "Boutique"));
      document.body.dataset.layout = D.template.layout || "catalog";
      document.body.classList.add("layout-" + String(D.template.layout || "catalog").replace(/[^a-z0-9_-]/gi, ""));
      document.documentElement.style.setProperty("--brand", D.design.primaryColor || "#17633d");
      document.documentElement.style.setProperty("--soft", D.design.secondaryColor || "#e9f5ec");
      document.documentElement.style.setProperty("--dark", D.design.darkColor || "#153c2c");
      document.querySelector('meta[name="description"]').setAttribute("content", String(D.business.seoDescription || D.business.headline || D.business.description || D.business.name).slice(0, 170));
      setBusinessContent(); fillCategories(); renderProducts();
      try {
        var loaded = JSON.parse(localStorage.getItem(key) || "{}");
        if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) cart = loaded;
      } catch (error) { cart = {}; }
      renderCart();
      search.addEventListener("input", renderProducts); category.addEventListener("change", renderProducts);
      grid.addEventListener("click", function (event) {
        var button = event.target.closest("[data-add-product]"); if (button) addProduct(button.dataset.addProduct);
      });
      byId("openCart").addEventListener("click", openCart); byId("openCartHero").addEventListener("click", openCart);
      byId("closeCart").addEventListener("click", closeCart); backdrop.addEventListener("click", closeCart);
      byId("checkoutBtn").addEventListener("click", checkout);
      cartLines.addEventListener("click", function (event) {
        var button = event.target.closest("[data-cart-action]"); if (!button) return;
        var id = button.dataset.productId, action = button.dataset.cartAction;
        if (action === "plus") { addProduct(id); return; }
        if (action === "minus") { cart[id] = (Number(cart[id]) || 0) - 1; if (cart[id] <= 0) delete cart[id]; }
        if (action === "remove") delete cart[id];
        renderCart();
        renderProducts();
      });
      byId("clearCartBtn").addEventListener("click", function () { cart = {}; renderCart(); announce("Panier vidé."); });
      byId("heroCatalogBtn").addEventListener("click", function () { byId("catalog").scrollIntoView({ behavior: "smooth" }); });
      document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeCart(); });
    }
    initialize();
  }
  function buildClientHtml(data) {
    var css = clientCss(), json = JSON.stringify(data).replace(/</g, "\\u003c"), page = [];
    page.push('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">');
    page.push('<meta name="theme-color" content="' + escapeHtml(data.design.primaryColor) + '">');
    page.push('<meta name="description" content="' + escapeHtml(String(data.business.seoDescription || data.business.headline || data.business.description || data.business.name).slice(0, 170)) + '">');
    page.push('<meta property="og:title" content="' + escapeHtml(data.business.seoTitle || (data.business.name + " | " + data.template.sector)) + '"><meta property="og:description" content="' + escapeHtml(data.business.seoDescription || data.business.headline || data.business.description || data.business.name) + '">');
    if (data.template.heroImage) page.push('<meta property="og:image" content="' + escapeHtml(safeUrl(data.template.heroImage)) + '">');
    page.push('<title>' + escapeHtml(data.business.seoTitle || (data.business.name + " | " + data.template.sector)) + '</title><style>' + css + '</style></head><body>');
    page.push('<header class="site-header"><div class="wrap header-inner"><a class="brand" href="#top" aria-label="Accueil"><span class="brand-mark" id="siteLogo">' + escapeHtml(String(data.business.name || "S").trim().charAt(0).toUpperCase()) + '</span><span class="brand-copy"><strong id="siteBusinessName">' + escapeHtml(data.business.name) + '</strong><small id="siteCity">' + escapeHtml([data.business.city, data.business.address].filter(Boolean).join(" · ") || "Contactez-nous") + '</small></span></a>');
    page.push('<nav class="main-nav" aria-label="Navigation principale"><a href="#catalog">Catalogue</a><a href="#about">À propos</a><a href="#contact">Contact</a></nav><div class="header-actions"><button id="openCart" class="btn btn-primary" type="button">Panier <span id="cartCount" class="cart-count">0</span></button></div></div></header><main id="top">');
    page.push('<section class="hero"><div class="wrap hero-grid"><div><span class="eyebrow" id="siteEyebrow">' + escapeHtml(data.template.eyebrow || data.template.sector) + '</span><h1 id="siteHeroTitle">' + escapeHtml(data.business.headline || "Bienvenue") + '</h1><p id="siteHeroDescription">' + escapeHtml(data.business.description || "Découvrez notre sélection et contactez-nous pour toute information.") + '</p><div class="hero-actions"><button class="btn btn-primary" id="heroCatalogBtn" type="button">Découvrir le catalogue <span aria-hidden="true">→</span></button><button class="btn btn-quiet" id="openCartHero" type="button">Ouvrir le panier</button><a class="btn btn-quiet" id="heroWhatsApp" data-whatsapp-link href="#contact">Commander par WhatsApp</a></div></div><div class="hero-image-wrap"><img id="heroImage" class="hero-image" src="' + escapeHtml(safeUrl(data.template.heroImage)) + '" alt="' + escapeHtml(data.template.sector || data.business.name) + '"><div class="hero-float">' + escapeHtml(data.business.name) + ' · ' + escapeHtml(data.business.city || "Sénégal") + '</div></div></div></section>');
    page.push('<section class="trust-strip"><div class="wrap trust-inner"><div class="trust-item"><span class="trust-icon">✓</span> Informations et prix visibles</div><div class="trust-item"><span class="trust-icon">↗</span> Commande simple via WhatsApp</div><div class="trust-item"><span class="trust-icon">◎</span> Contact direct avec le vendeur</div></div></section>');
    page.push('<section class="section" id="catalog"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">La sélection</span><h2>Nos produits</h2></div><p>Choisis tes articles et ajoute-les au panier. La disponibilité et les conditions sont confirmées avant validation.</p></div><div class="shop-tools"><label class="sr-only" for="productSearch">Rechercher un produit</label><input id="productSearch" class="shop-input" type="search" placeholder="Rechercher un produit…"><label class="sr-only" for="categoryFilter">Catégorie</label><select id="categoryFilter" class="shop-select"><option value="">Toutes les catégories</option></select><span class="product-count" id="productCount"></span></div><div class="product-grid" id="productGrid"></div><p class="empty-products" id="noProducts" hidden>Aucun produit ne correspond à cette recherche.</p></div></section>');
    page.push('<section class="section" id="about"><div class="wrap about-panel"><div><span class="eyebrow">Notre entreprise</span><h2 id="aboutTitle">À propos</h2><p id="aboutDescription">' + escapeHtml(data.business.description || "") + '</p></div><div class="feature-list" id="featureList"></div></div></section>');
    page.push('<section class="section contact-section" id="contact"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">Restons en contact</span><h2>Une question ou une commande ?</h2></div><p>Contacte directement l’équipe pour confirmer les disponibilités et les modalités de livraison.</p></div><div class="contact-grid"><div class="contact-card"><small>Téléphone</small><a data-phone-link href="#contact">Non renseigné</a></div><div class="contact-card"><small>WhatsApp</small><a data-whatsapp-link href="#contact">Écrire au vendeur</a></div><div class="contact-card"><small>E-mail</small><a data-email-link href="#contact">Non renseigné</a></div></div><div class="contact-grid" style="margin-top:15px"><div class="contact-card"><small>Adresse</small><strong id="siteAddress">Adresse sur demande</strong></div><div class="contact-card"><small>Disponibilité</small><strong id="siteHours">Contactez-nous.</strong></div><div class="contact-card"><small>Livraison et retrait</small><strong id="siteDelivery">Modalités à confirmer.</strong></div></div><div class="social-links" id="socialLinks"></div></div></section></main>');
    page.push('<footer class="site-footer"><div class="wrap footer-inner"><div>© <span id="siteYear"></span> <strong id="siteFooterName">' + escapeHtml(data.business.name) + '</strong> <span id="siteFooterCity">' + escapeHtml(data.business.city || "") + '</span></div><div class="footer-note">Les prix, la disponibilité et les modalités de livraison sont confirmés par le vendeur. Site vitrine avec commande via WhatsApp.</div></div></footer>');
    page.push('<div id="cartBackdrop" class="backdrop" aria-hidden="true"></div><aside class="cart-drawer" id="cartDrawer" aria-label="Panier" aria-hidden="true"><div class="drawer-head"><h2>Ton panier</h2><button id="closeCart" class="icon-button" type="button" aria-label="Fermer le panier">×</button></div><div id="cartLines" class="cart-lines"></div><div class="cart-total"><div class="cart-subtotal-row"><span>Sous-total indicatif</span><strong id="cartSubtotal">0 F CFA</strong></div><small id="cartTotalsNote" class="cart-totals-note">Le vendeur confirmera le montant final.</small><small id="cartSummary">Ajoute des produits avant de poursuivre.</small><div class="checkout-details"><label for="customerName">Ton nom <input id="customerName" maxlength="140" autocomplete="name" placeholder="Nom complet"></label><label for="customerPhone">Téléphone <input id="customerPhone" maxlength="40" autocomplete="tel" type="tel" placeholder="+221 77 000 00 00"></label><label for="customerAddress">Adresse ou quartier <input id="customerAddress" maxlength="500" autocomplete="street-address" placeholder="Facultatif"></label><label for="customerNotes">Note pour le vendeur <input id="customerNotes" maxlength="1000" placeholder="Livraison, variantes…"></label></div><button id="checkoutBtn" class="btn btn-primary full-width" type="button">Envoyer la commande</button><button id="clearCartBtn" class="btn btn-quiet full-width" style="margin-top:8px" type="button">Vider le panier</button></div></aside><div id="siteToast" class="toast" role="status" aria-live="polite"></div>');
    page.push('<script>window.SAMA_STORE_DATA=' + json + ';(' + clientRuntime.toString() + ')();</script></body></html>');
    return page.join("\n");
  }
  function validateForExport(data, requireChecklist) {
    var confirmation = document.getElementById("releaseChecklistConfirmed");
    if (requireChecklist && (!confirmation || !confirmation.checked)) {
      announce("Effectue et coche le contrôle final avant de télécharger le site client.");
      return false;
    }
    if (!data.business.name || data.business.name.toLocaleLowerCase("fr") === "votre entreprise") { announce("Renseigne le vrai nom de l’entreprise avant la livraison."); return false; }
    if (!data.products.length) { announce("Ajoute au moins un produit au catalogue."); return false; }
    if (data.products.some(function (product) { return !product.name; })) { announce("Chaque produit doit avoir un nom."); return false; }
    if (requireChecklist && !data.products.some(function (product) { return !product.isExample && product.stockQuantity > 0; })) { announce("Remplace au moins un exemple par un produit ou service réel, puis indique au moins une disponibilité supérieure à zéro."); return false; }
    return true;
  }
  function previewWebsite() {
    syncPreviewProducts();
    persistReleaseDraft();
    var target = $("#storePreview");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    announce("Aperçu actualisé. Votre site final sera hébergé après validation.");
  }
  function persistReleaseDraft() {
    try { localStorage.setItem("sama_studio_release_draft_v1", JSON.stringify(collectData())); }
    catch (error) { /* Stockage indisponible : l’export reste actif. */ }
  }
  function restoreDraft() {
    try {
      var saved = JSON.parse(localStorage.getItem("sama_studio_release_draft_v1") || "null"), template = activeTemplate();
      if (!saved || !template || !saved.template || saved.template.id !== template.id) return;
      if (saved.business) {
        var mapping = { businessAddress:"address", businessEmail:"email", businessDescription:"description", businessHours:"hours", businessDelivery:"delivery", businessInstagram:"instagram", businessFacebook:"facebook", seoTitle:"seoTitle", seoDescription:"seoDescription" };
        Object.keys(mapping).forEach(function (id) { if (field(id)) field(id).value = saved.business[mapping[id]] || getExtraDefaults()[id] || ""; });
      }
      if (Array.isArray(saved.products) && saved.products.length) state.products = saved.products.map(function (p) {
        return { id:p.id || slug(p.name), name:p.name || "", category:p.category || "", price:p.price || "", image:safeUrl(p.image), description:p.description || "", stockQuantity:Math.max(0,Math.min(999999,Math.floor(Number(p.stockQuantity)||0))), customized:p.isExample===false || Boolean(p.customized) };
      });
    } catch (error) { /* Brouillon illisible : garder les valeurs du modèle. */ }
  }
  function bind() {
    addExtraFields(); addReleasePanel();
    var template = activeTemplate();
    if (!template) { announce("Le registre des modèles est introuvable."); return; }
    state.templateId = template.id; state.products = cloneProducts(template);
    restoreDraft(); renderProductEditor(); syncPreviewProducts();
    $("#addSiteProductBtn").addEventListener("click", function () {
      if (state.products.length >= 500) return announce("Le plafond de catalogue dépend de votre formule Sama Studio.");
      state.productCounter += 1;
      state.products.push({ id:"nouveau-produit-" + state.productCounter, name:"Nouveau produit " + state.productCounter,
        category:template.sector || "Catalogue", price:"Prix sur demande", image:"", description:"Ajoute ici une description vérifiée du produit.", stockQuantity:0, customized:false });
      renderProductEditor(); syncPreviewProducts(); persistReleaseDraft(); announce("Produit ajouté au catalogue.");
    });
    $("#submitForReviewBottomBtn").addEventListener("click", submitForReview);
    $("#previewWebsiteBtn").addEventListener("click", previewWebsite);
    window.SAMA_PUBLISHER = {
      submitForReview: submitForReview,
      previewWebsite: previewWebsite,
      persistDraft: persistReleaseDraft,
      getCurrentData: collectData
    };
    var form = $("#projectForm");
    if (form) form.addEventListener("submit", function () { window.setTimeout(saveExtendedDraft, 0); });
    Object.keys(getExtraDefaults()).forEach(function (id) {
      var input = field(id);
      if (input) { input.addEventListener("input", persistReleaseDraft); input.addEventListener("change", persistReleaseDraft); }
    });

    var resetButton = $("#resetConfigBtn");
    if (resetButton) resetButton.addEventListener("click", function () {
      state.products = cloneProducts(activeTemplate());
      Object.keys(getExtraDefaults()).forEach(function (id) {
        if (field(id)) field(id).value = getExtraDefaults()[id];
      });
      ["seoTitle", "seoDescription"].forEach(function (id) { if (field(id)) field(id).value = ""; });
      renderProductEditor();
      syncPreviewProducts();
      persistReleaseDraft();
    });
    var selector = $("#activeTemplateName");
    if (selector && window.MutationObserver) {
      var observer = new MutationObserver(function () {
        var next = activeTemplate();
        if (next && next.id !== state.templateId) {
          state.templateId = next.id; state.products = cloneProducts(next);
          var confirmation = field("releaseChecklistConfirmed"); if (confirmation) confirmation.checked = false;
          renderProductEditor(); syncPreviewProducts(); persistReleaseDraft();
        }
      });
      observer.observe(selector, { childList:true, characterData:true, subtree:true });
    }
  }
  document.addEventListener("DOMContentLoaded", bind);
})();