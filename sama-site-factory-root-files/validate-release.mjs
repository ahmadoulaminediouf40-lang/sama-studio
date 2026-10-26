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
const publisherSource = readFileSync(join(root,"site-publisher.js"),"utf8");
for (const marker of ["seoTitle: fieldValue(\"seoTitle\")", "seoDescription: fieldValue(\"seoDescription\")", "property=\"og:title\"", "property=\"og:description\"", "property=\"og:image\"", "D.business.seoTitle ||", "D.business.seoDescription ||"]) assert.ok(publisherSource.includes(marker), "Missing generated SEO metadata: " + marker);
const templates = readFileSync(join(root,"site-templates.js"),"utf8");
for (const id of ["distribution","fashion","beauty","electronics","home","grocery","restaurant","bakery","services","realestate"]) assert.ok(templates.includes('id: "'+id+'"'),"Missing template: "+id);
const publisher = readFileSync(join(root,"site-publisher.js"),"utf8");
for (const marker of ["submitForReviewBottomBtn","previewWebsiteBtn","productSearch","categoryFilter","checkoutBtn","SAMA_STORE_DATA","wa.me/"]) assert.ok(publisher.includes(marker),"Missing storefront feature: "+marker);
console.log("Sama Studio validation passed: assets, 10 templates, site submission, SEO metadata and WhatsApp checkout.");
