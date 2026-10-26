/* Sama Studio — repérage visuel des champs requis avant demande de validation. */
(function () {
  "use strict";
  var style = document.createElement("style");
  style.textContent = [
    ".validation-required-mark{display:inline-block;margin-left:5px;color:#c62828;font-size:11px;font-weight:900}",
    ".validation-field-error{display:block;margin-top:6px;color:#b42318;font-size:12px;font-weight:700;line-height:1.45}",
    ".validation-invalid{border-color:#d92d20!important;background-color:#fff7f6!important;box-shadow:0 0 0 3px #d92d201c!important}",
    ".validation-invalid-label{color:#b42318!important}",
    ".release-confirmation.validation-invalid{outline:2px solid #d92d20;outline-offset:5px;border-radius:8px}",
    ".validation-summary{margin:0 0 12px;padding:11px 13px;border:1px solid #f3b6b1;border-radius:10px;background:#fff4f2;color:#9b2119;font-size:12px;font-weight:750;line-height:1.55}"
  ].join("\n");
  document.head.appendChild(style);

  function $(selector, root) { return (root || document).querySelector(selector); }
  function all(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function notify(message) {
    var toast = $("#studioToast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("visible");
      window.clearTimeout(notify.timer);
      notify.timer = window.setTimeout(function () { toast.classList.remove("visible"); }, 4500);
    }
  }
  function setError(input, message) {
    if (!input) return;
    input.classList.add("validation-invalid");
    input.setAttribute("aria-invalid", "true");
    var label = input.closest("label");
    if (label) {
      label.classList.add("validation-invalid-label");
      var error = $(".validation-field-error", label);
      if (!error) { error = document.createElement("span"); error.className = "validation-field-error"; label.appendChild(error); }
      error.textContent = message;
    }
  }
  function clearError(input) {
    if (!input) return;
    input.classList.remove("validation-invalid");
    input.removeAttribute("aria-invalid");
    var label = input.closest("label");
    if (label) {
      label.classList.remove("validation-invalid-label");
      all(".validation-field-error", label).forEach(function (node) { node.remove(); });
    }
  }
  function requiredLabel(label, text) {
    if (!label || $(".validation-required-mark", label)) return;
    var mark = document.createElement("span");
    mark.className = "validation-required-mark";
    mark.textContent = "*";
    mark.setAttribute("aria-hidden", "true");
    label.appendChild(mark);
    label.setAttribute("data-required-label", text || "Champ obligatoire");
  }
  function addSummary(message) {
    var panel = $("#release-panel-validation-summary");
    var actions = $(".release-export-actions");
    if (!panel && actions) {
      panel = document.createElement("p");
      panel.id = "release-panel-validation-summary";
      panel.className = "validation-summary";
      panel.setAttribute("role", "alert");
      actions.parentNode.insertBefore(panel, actions);
    }
    if (panel) panel.textContent = message;
  }
  function clearSummary() {
    var panel = $("#release-panel-validation-summary");
    if (panel) panel.remove();
  }
  function markRequiredFields() {
    var businessName = $("#businessName");
    if (businessName) requiredLabel(businessName.closest("label"), "Nom de l’entreprise obligatoire");
    var city = $("#businessCity");
    if (city) requiredLabel(city.closest("label"), "Ville obligatoire");
    ["businessPhone", "businessWhatsapp"].forEach(function (id) {
      var input = $("#" + id);
      if (input) requiredLabel(input.closest("label"), "Renseignez au moins un numéro de téléphone ou WhatsApp");
    });
    var checkbox = $("#releaseChecklistConfirmed");
    if (checkbox) {
      var label = checkbox.closest("label");
      if (label) requiredLabel(label, "Confirmation obligatoire");
    }
    all(".product-edit-card").forEach(function (card) {
      [
        ["name", "Nom du produit obligatoire"],
        ["price", "Prix obligatoire"],
        ["description", "Description obligatoire"],
        ["image", "Image du produit obligatoire"],
        ["stockQuantity", "Disponibilité obligatoire"]
      ].forEach(function (entry) {
        var input = $('[data-product-key="' + entry[0] + '"]', card);
        if (input) requiredLabel(input.closest("label"), entry[1]);
      });
    });
  }
  function validateAndSubmit() {
    clearSummary();
    all(".validation-invalid").forEach(function (input) { clearError(input); });
    var errors = [];
    var name = $("#businessName");
    if (!name || !name.value.trim() || name.value.trim().toLocaleLowerCase("fr") === "votre entreprise") {
      setError(name, "Saisissez le vrai nom de votre entreprise.");
      errors.push(name);
    }
    var city = $("#businessCity");
    if (!city || !city.value.trim()) {
      setError(city, "Indiquez la ville de votre entreprise.");
      errors.push(city);
    }
    var phone = $("#businessPhone"), whatsapp = $("#businessWhatsapp");
    if (!(phone && phone.value.trim()) && !(whatsapp && whatsapp.value.trim())) {
      setError(phone, "Renseignez un téléphone ou un numéro WhatsApp.");
      setError(whatsapp, "Renseignez un téléphone ou un numéro WhatsApp.");
      errors.push(phone || whatsapp);
    }

    var cards = all(".product-edit-card").filter(function (card) { return !!$('[data-product-key="name"]', card); });
    var realReady = false;
    var firstProductErrors = [];
    cards.forEach(function (card) {
      var nameInput = $('[data-product-key="name"]', card);
      var priceInput = $('[data-product-key="price"]', card);
      var descriptionInput = $('[data-product-key="description"]', card);
      var imageInput = $('[data-product-key="image"]', card);
      var stockInput = $('[data-product-key="stockQuantity"]', card);
      var productName = nameInput ? nameInput.value.trim() : "";
      var price = priceInput ? priceInput.value.trim() : "";
      var description = descriptionInput ? descriptionInput.value.trim() : "";
      var image = imageInput ? imageInput.value.trim() : "";
      var stock = stockInput ? Number(stockInput.value) : 0;
      var customized = !!(nameInput && nameInput.dataset.productIndex !== undefined &&
        (nameInput.value.trim() !== "" && !/^produit\s+\d+$/i.test(nameInput.value.trim())));
      var isRealCandidate = customized || [price, description, image].some(function (value) { return !!value; });
      var valid = !!productName && !!price && !/^prix sur demande$/i.test(price) &&
        !!description && !!image && Number.isFinite(stock) && stock > 0;
      if (valid && isRealCandidate) realReady = true;
      if (isRealCandidate && !valid) {
        [[nameInput, "Saisissez le nom du produit."],
         [priceInput, "Indiquez un prix réel, pas « Prix sur demande »."],
         [descriptionInput, "Ajoutez une description utile."],
         [imageInput, "Ajoutez une image via une URL ou la médiathèque."],
         [stockInput, "Indiquez une disponibilité supérieure à zéro."]].forEach(function (entry) {
          if (entry[0] && (!entry[0].value.trim() || (entry[0] === priceInput && /^prix sur demande$/i.test(entry[0].value.trim())) ||
              (entry[0] === stockInput && !(Number(entry[0].value) > 0)))) {
            setError(entry[0], entry[1]);
            firstProductErrors.push(entry[0]);
          }
        });
      }
    });
    if (!cards.length) {
      notify("Ajoutez au moins un produit à votre catalogue.");
      var productsStep = $('[data-studio-step="products"]');
      if (productsStep) productsStep.click();
      return;
    }
    if (!realReady) {
      if (!firstProductErrors.length && cards[0]) {
        var first = cards[0];
        var productName = $('[data-product-key="name"]', first);
        var priceInput = $('[data-product-key="price"]', first);
        var descriptionInput = $('[data-product-key="description"]', first);
        var imageInput = $('[data-product-key="image"]', first);
        var stockInput = $('[data-product-key="stockQuantity"]', first);
        setError(productName, "Remplacez au moins un exemple par un produit réel.");
        setError(priceInput, "Indiquez le prix réel du produit.");
        setError(descriptionInput, "Renseignez une description réelle.");
        setError(imageInput, "Ajoutez une image réelle du produit.");
        setError(stockInput, "Indiquez une disponibilité supérieure à zéro.");
        firstProductErrors.push(productName, priceInput, descriptionInput, imageInput, stockInput);
      }
      errors = errors.concat(firstProductErrors);
    }
    var confirmation = $("#releaseChecklistConfirmed");
    if (!confirmation || !confirmation.checked) {
      if (confirmation) {
        confirmation.classList.add("validation-invalid");
        confirmation.setAttribute("aria-invalid", "true");
        var label = confirmation.closest("label");
        if (label) {
          label.classList.add("validation-invalid-label");
          var error = $(".validation-field-error", label);
          if (!error) { error = document.createElement("span"); error.className = "validation-field-error"; label.appendChild(error); }
          error.textContent = "Cochez cette case après avoir vérifié les informations et le produit réel.";
        }
      }
      errors.push(confirmation);
    }
    if (errors.length) {
      addSummary("Certains champs obligatoires sont manquants ou incorrects. Ils sont signalés en rouge : complétez-les avant l’envoi.");
      var firstError = errors.filter(Boolean)[0];
      if (firstError) {
        var parentCard = firstError.closest(".product-edit-card");
        if (parentCard) {
          var step = $('[data-studio-step="products"]');
          if (step) step.click();
        } else if (firstError.closest(".project-form")) {
          var customize = $('[data-studio-step="customize"]');
          if (customize) customize.click();
        }
        window.setTimeout(function () {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof firstError.focus === "function") firstError.focus({ preventScroll: true });
        }, 80);
      }
      notify("Vérifie les champs signalés en rouge avant de continuer.");
      return;
    }
    if (window.SAMA_PUBLISHER && typeof window.SAMA_PUBLISHER.submitForReview === "function") {
      window.SAMA_PUBLISHER.submitForReview();
    } else {
      notify("Le système d’enregistrement se prépare. Réessaie dans quelques secondes.");
    }
  }
  document.addEventListener("click", function (event) {
    var button = event.target.closest("#submitForReviewBtn, #submitForReviewBottomBtn");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    validateAndSubmit();
  }, true);
  document.addEventListener("input", function (event) {
    if (event.target.matches(".validation-invalid")) {
      clearError(event.target);
      clearSummary();
    }
  });
  document.addEventListener("change", function (event) {
    if (event.target.matches(".validation-invalid")) {
      clearError(event.target);
      clearSummary();
    }
    if (event.target.id === "releaseChecklistConfirmed" && event.target.checked) {
      event.target.classList.remove("validation-invalid");
      event.target.removeAttribute("aria-invalid");
      var label = event.target.closest("label");
      if (label) {
        label.classList.remove("validation-invalid-label");
        all(".validation-field-error", label).forEach(function (node) { node.remove(); });
      }
    }
  });
  function initialize() {
    markRequiredFields();
    var panel = $(".release-panel");
    if (panel && window.MutationObserver) {
      new MutationObserver(markRequiredFields).observe(panel, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();