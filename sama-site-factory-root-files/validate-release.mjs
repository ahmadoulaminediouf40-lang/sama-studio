import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
for (const name of ["site-studio.html","site-studio.css","site-release.css","site-templates.js","site-studio.js","site-publisher.js"]) {
  assert.ok(existsSync(join(root,name)), "Missing required file: " + name);
}
const html = readFileSync(join(root,"site-studio.html"),"utf8");
for (const asset of ["site-release.css","site-templates.js","site-studio.js","site-publisher.js"]) assert.ok(html.includes(asset),"Missing reference: "+asset);
const editor = readFileSync(join(root,"site-studio.html"),"utf8");
for (const field of ['id="seoTitle"', 'id="seoDescription"', 'Référencement et partage']) assert.ok(editor.includes(field), "Missing SEO editor control: " + field);
for (const field of ['id="heroImageUrl"']) assert.ok(editor.includes(field), "Missing image editor control: " + field);

const publisherSource = readFileSync(join(root,"site-publisher.js"),"utf8");
assert.ok(publisherSource.includes('id="sitePagesEditor"') && publisherSource.includes('id="addSitePageBtn"'), "Missing custom page editor.");
assert.ok(publisherSource.includes('id="mediaUploadInput"') && publisherSource.includes('function handleMediaUpload'), "Missing media library.");
assert.ok(publisherSource.includes('id="siteRevisionList"') && publisherSource.includes('function restoreRevision'), "Missing version history.");
assert.ok(publisherSource.includes('custom-content-section') && publisherSource.includes('var customNav'), "Missing published custom pages and navigation.");
assert.ok(publisherSource.includes('safeImageUrl') && publisherSource.includes('150 * 1024'), "Missing safe image handling or media upload limits.");
for (const marker of ["seoTitle: fieldValue(\"seoTitle\")", "seoDescription: fieldValue(\"seoDescription\")", "property=\"og:title\"", "property=\"og:description\"", "property=\"og:image\"", "D.business.seoTitle ||", "D.business.seoDescription ||", "seoTitle:\"seoTitle\"", "seoDescription:\"seoDescription\"", "persistReleaseDraft"]) assert.ok(publisherSource.includes(marker), "Missing generated SEO metadata: " + marker);
const templates = readFileSync(join(root,"site-templates.js"),"utf8");
for (const id of ["distribution","fashion","beauty","electronics","home","grocery","restaurant","bakery","services","realestate"]) assert.ok(templates.includes('id: "'+id+'"'),"Missing template: "+id);
assert.ok(!/sama[\s_-]*pack/i.test(templates), "Unrelated SAMA-PACK brand leaked into sample templates.");
const publisher = readFileSync(join(root,"site-publisher.js"),"utf8");
for (const marker of ["submitForReviewBottomBtn","previewWebsiteBtn","productSearch","categoryFilter","checkoutBtn","SAMA_STORE_DATA","wa.me/","sitePagesEditor","siteMediaGrid","siteRevisionList","restoreRevision","custom-content-section","safeImageUrl"]) assert.ok(publisher.includes(marker),"Missing storefront feature: "+marker);
console.log("Sama Studio validation passed: assets, 10 templates, site submission, SEO metadata and WhatsApp checkout.");
