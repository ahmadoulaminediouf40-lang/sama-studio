import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CONFIG_KEY="sama_studio_supabase_config_v1";
const DEFAULT_CONFIG={url:"https://jubrkdxrjvkjdlodslcp.supabase.co",key:"sb_publishable_HqIc0fSxhQ9iDThqFXl55g_SJTEiM5h"};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={supabase:null,user:null,organizations:[],organization:null,role:null,sites:[],products:[],orders:[],managementRequests:[],supportRequests:[],reviewSites:[],reviewProducts:[],reviewNotifications:[],orgUsage:null,isSamaAdmin:false,editingSiteId:null,editingHtml:"",view:"overview",authMode:"signin"};
function node(tag,cls="",text=""){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined&&text!==null)e.textContent=String(text);return e;}
function append(parent,...children){children.forEach(child=>{if(child)parent.appendChild(child);});return parent;}
function escapeSlug(v){return String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,55);}
function parsePrice(v){const m=String(v||"").replace(/\u00a0/g," ").replace(/,/g,".").match(/\d[\d\s.]*/);if(!m)return 0;const n=Number(m[0].replace(/[\s.]/g,""));return Number.isFinite(n)?Math.max(0,n):0;}
function formatMoney(v,c="XOF"){try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency:c,maximumFractionDigits:0}).format(Number(v)||0);}catch{return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number(v)||0)+" "+c;}}
function formatDate(v){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(d);}
function friendlyError(e){const m=String(e?.message||e||"Une erreur est survenue.");if(/Failed to fetch|NetworkError/i.test(m))return "Connexion impossible. Vérifie ta connexion Internet et réessaie.";if(/Invalid login credentials/i.test(m))return "E-mail ou mot de passe incorrect.";if(/Email not confirmed/i.test(m))return "Confirme d’abord ton adresse e-mail, puis reconnecte-toi.";if(/row-level security|permission denied|not authorized/i.test(m))return "Tu n’as pas les autorisations nécessaires pour cette action.";if(/duplicate key|already exists/i.test(m))return "Cette valeur existe déjà. Choisis une autre référence.";if(/relation .* does not exist|schema cache/i.test(m))return "Le service n’est pas encore disponible. Réessaie plus tard ou contacte l’assistance.";return m.slice(0,320);}
let toastTimeout;
function toast(message,error=false){const e=$("#dashboardToast");e.textContent=message;e.classList.toggle("error",error);e.classList.add("visible");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>e.classList.remove("visible"),4600);}
function setConnectionStatus(connected,message){const e=$("#connectionStatus");if(!e)return;e.classList.toggle("connected",Boolean(connected));if(e.childNodes.length>1)e.childNodes[e.childNodes.length-1].textContent=" "+(message||(connected?"Service disponible":"Connexion à vérifier"));else e.appendChild(document.createTextNode(" "+(message||(connected?"Service disponible":"Connexion à vérifier"))));}
function showOnly(id){["authPanel","organizationOnboarding","dashboardPanel"].forEach(n=>$("#"+n).classList.toggle("hidden",n!==id));$("#signOutBtn").classList.toggle("hidden",id!=="dashboardPanel");}
async function configureSupabase(url,key){const cleanUrl=url.replace(/\/$/,"");state.supabase=createClient(cleanUrl,key.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data,error}=await state.supabase.auth.getSession();if(error)throw error;if(data.session?.user){state.user=data.session.user;await showWorkspace();}else{state.user=null;$("#authMessage").textContent="";showOnly("authPanel");}setConnectionStatus(true,"Service disponible");}
function setAuthMode(){state.authMode="signin";$("#authTitle").textContent="Administration privée SAMA.";$("#authDescription").textContent="Connecte-toi avec le compte propriétaire autorisé. Les clients achètent depuis les boutiques et n’ont pas accès à cet espace.";$("#signupNameWrap").classList.add("hidden");$("#toggleAuthModeBtn").hidden=true;$("#authSubmitBtn").textContent="Se connecter";$("#authPassword").autocomplete="current-password";$("#authMessage").textContent="";$("#authMessage").classList.remove("error");}
function setBusy(button,busy,label){button.disabled=busy;if(!button.dataset.originalLabel)button.dataset.originalLabel=button.textContent;button.textContent=busy?label:button.dataset.originalLabel;}
async function onAuthSubmit(event){event.preventDefault();const button=$("#authSubmitBtn"),email=$("#authEmail").value.trim(),password=$("#authPassword").value,message=$("#authMessage");message.classList.remove("error");message.textContent="";setBusy(button,true,"Vérification…");try{const {data,error}=await state.supabase.auth.signInWithPassword({email,password});if(error)throw error;state.user=data.user;await showWorkspace();}catch(e){message.textContent=friendlyError(e);message.classList.add("error");}finally{setBusy(button,false);}}async function signOut(){if(!state.supabase)return;const {error}=await state.supabase.auth.signOut();if(error)return toast(friendlyError(error),true);state.user=null;state.organization=null;state.organizations=[];state.isSamaAdmin=false;state.supportRequests=[];state.reviewSites=[];state.reviewProducts=[];state.reviewNotifications=[];state.orgUsage=null;$("#supportNavItem").hidden=true;$("#reviewNavItem").hidden=true;$("#userEmail").textContent="";$("#authEmail").value="";$("#authPassword").value="";setAuthMode("signin");showOnly("authPanel");toast("Déconnexion effectuée.");}
async function showWorkspace(){
 if(!state.user)return showOnly("authPanel");
 $("#userEmail").textContent=state.user.email||"";showOnly("dashboardPanel");
 try{
  const [adminResult,membershipResult]=await Promise.all([
   state.supabase.from("site_management_admins").select("user_id").eq("user_id",state.user.id).maybeSingle(),
   state.supabase.from("organization_memberships").select("organization_id,role,created_at").eq("user_id",state.user.id)
  ]);
  if(adminResult.error)throw adminResult.error;if(membershipResult.error)throw membershipResult.error;
  state.isSamaAdmin=Boolean(adminResult.data);
  if(!state.isSamaAdmin){
   await state.supabase.auth.signOut();
   state.user=null;state.organization=null;state.organizations=[];state.role=null;
   showOnly("authPanel");
   $("#authMessage").textContent="Accès refusé. Cette administration est réservée au compte propriétaire de SAMA.";
   $("#authMessage").classList.add("error");
   return;
  }
  const memberships=membershipResult.data||[];
  $("#supportNavItem").hidden=true;$("#reviewNavItem").hidden=true;
  const ids=memberships.map(m=>m.organization_id);
  if(ids.length){
   const {data,error}=await state.supabase.from("organizations").select("id,name,slug,owner_id,created_at,subscription_plan,subscription_status,account_status,trial_ends_at,activated_at").in("id",ids).order("created_at",{ascending:true});
   if(error)throw error;state.organizations=data||[];
  }else state.organizations=[];
  if(!state.organizations.length){
   state.organization=null;state.role=null;state.sites=[];state.products=[];state.orders=[];state.managementRequests=[];state.orgUsage=null;
   $(".organization-switcher").classList.toggle("hidden",state.isSamaAdmin);$(".org-select-label").classList.toggle("hidden",state.isSamaAdmin);$("#organizationSelect").classList.toggle("hidden",state.isSamaAdmin);
   $$(".nav-item").forEach(button=>{button.hidden=state.isSamaAdmin?!["review","support"].includes(button.dataset.view):button.dataset.view==="review"||button.dataset.view==="support";});
   if(state.isSamaAdmin){showOnly("dashboardPanel");toast("Aucun espace propriétaire SAMA n’est associé à ce compte.",true);return;}
   showOnly("organizationOnboarding");return;
  }
  $(".organization-switcher").classList.remove("hidden");$(".org-select-label").classList.remove("hidden");$("#organizationSelect").classList.remove("hidden");
  $(".nav-item").forEach(button=>{if(button.dataset.view==="support"||button.dataset.view==="review")button.hidden=true;else button.hidden=false;});
  const saved=localStorage.getItem("sama_studio_active_org_v1");
  state.organization=state.organizations.find(o=>o.id===saved)||state.organizations[0];
  localStorage.setItem("sama_studio_active_org_v1",state.organization.id);
  $("#organizationSelect").replaceChildren();
  state.organizations.forEach(org=>{const o=node("option","",org.name);o.value=org.id;o.selected=org.id===state.organization.id;$("#organizationSelect").appendChild(o);});
  const membership=memberships.find(m=>m.organization_id===state.organization.id);
  state.role=membership?.role||"viewer";
  $("#activeOrganizationName").textContent=state.organization.name;$("#orgAvatar").textContent=(state.organization.name||"S").trim().charAt(0).toUpperCase();
  $("#settingsOrgName").textContent=state.organization.name;$("#settingsOrgSlug").textContent=state.organization.slug;
  $("#settingsRole").textContent=({owner:"Propriétaire",admin:"Administrateur",staff:"Équipe",viewer:"Lecture seule"})[state.role]||state.role;
  $("#settingsUserEmail").textContent=state.user.email||"—";
  await reloadData();
  const firstPartySlugs=["sama-market","sama-mode","sama-beaute","sama-tech","sama-maison","sama-epicerie","sama-bebe-famille","sama-papeterie-bureau","sama-auto-moto","sama-sport-loisirs"];
  const ownedStores=state.sites.filter(site=>firstPartySlugs.includes(site.slug)).length;
  if(state.isSamaAdmin&&state.organization?.owner_id===state.user?.id&&state.role==="owner"&&ownedStores<firstPartySlugs.length){
    await createMyBoutiques();
  }
  // SAMA Commerce does not use the customer-site approval queue.
 }catch(e){showOnly("dashboardPanel");toast(friendlyError(e),true);}
}
function formatBytes(value){const bytes=Math.max(0,Number(value)||0);if(bytes<1000)return bytes+" o";if(bytes<1000000)return (bytes/1000).toLocaleString("fr-FR",{maximumFractionDigits:1})+" Ko";return (bytes/1000000).toLocaleString("fr-FR",{maximumFractionDigits:2})+" Mo";}
async function reloadData(){
 if(!state.organization)return;
 const id=state.organization.id;
 const [a,b,c,d,usageResult]=await Promise.all([
  state.supabase.from("sites").select("id,organization_id,name,slug,template_id,status,review_status,review_note,submitted_at,reviewed_at,published_url,cloudflare_project_name,cloudflare_deployment_id,created_by,created_at,updated_at,published_at").eq("organization_id",id).order("updated_at",{ascending:false}),
  state.supabase.from("products").select("id,organization_id,site_id,external_ref,sku,name,category,description,image_url,price,price_label,currency,stock_quantity,low_stock_threshold,is_active,is_demo,source_store_name,source_url,source_price,source_currency,source_exchange_rate,source_shipping_xof,other_costs_xof,margin_percent,source_checked_at,fulfillment_mode,created_at,updated_at").eq("organization_id",id).order("name",{ascending:true}),
  state.supabase.from("orders").select("id,order_number,organization_id,site_id,customer_name,customer_phone,customer_email,customer_address,notes,status,total,currency,source,payment_status,payment_method,procurement_status,supplier_order_reference,delivery_provider,tracking_code,estimated_delivery_at,delivered_at,delivery_fee_xof,estimated_delivery_cost_xof,estimated_purchase_cost_xof,actual_purchase_cost_xof,actual_delivery_cost_xof,created_at,order_items(product_name,sku,quantity,unit_price,price_label,line_total,source_store_name,source_url,source_unit_price,source_currency,unit_cost_xof,line_cost_xof,estimated_margin_xof,source_checked_at)").eq("organization_id",id).order("created_at",{ascending:false}).limit(500),
  state.supabase.from("site_management_requests").select("id,organization_id,site_id,requested_by,message,status,created_at,updated_at").eq("organization_id",id).order("created_at",{ascending:false}).limit(100),
  state.supabase.rpc("get_organization_usage",{p_organization_id:id})
 ]);
 const failed=[a,b,c,d].find(r=>r.error);if(failed)throw failed.error;
 state.sites=a.data||[];state.products=b.data||[];state.orders=c.data||[];state.managementRequests=d.data||[];
 if(!usageResult.error&&usageResult.data)state.orgUsage=usageResult.data;
 if(state.editingSiteId&&!state.sites.some(s=>s.id===state.editingSiteId))state.editingSiteId=null;
 fillSiteSelects();renderOverview();renderSites();renderProducts();renderOrders();renderManagementRequests();
 $("#siteNavCount").textContent=String(state.sites.length);
 $("#orderNavCount").textContent=String(state.orders.filter(o=>!["completed","cancelled"].includes(o.status)).length);
 updatePlanSummary();
 if(state.isSamaAdmin)await reloadReviewQueue();
 if(!state.editingSiteId&&state.sites.length){const select=$("#siteEditorSiteSelect");if(select)await loadSiteEditor(select.value||state.sites[0].id);}
}
function updatePlanSummary(){
 if(state.isSamaAdmin&&state.organization?.owner_id===state.user?.id){
  $("#settingsPlanName").textContent="SAMA Commerce · Propriétaire";
  $("#settingsUsageSummary").textContent=state.sites.length+" boutiques · "+state.products.length+" produits · espace interne";
  $("#settingsAccountStatus").textContent="Actif";
  $("#settingsAccountNote").textContent="Cet espace gère les boutiques SAMA que tu possèdes. Les prix sources, les achats et les livraisons doivent rester vérifiés par commande.";
  $("#settingsOrgName").textContent=state.organization.name;$("#settingsOrgSlug").textContent=state.organization.slug;
  $("#settingsRole").textContent="Administrateur propriétaire";$("#settingsUserEmail").textContent=state.user.email||"—";
  return;
 }
 const usage=state.orgUsage;
 if(!usage){
  $("#settingsPlanName").textContent=state.organization?.subscription_plan||"—";
  $("#settingsUsageSummary").textContent="Impossible de charger la capacité de votre formule.";
  $("#settingsAccountStatus").textContent="—";
  $("#settingsAccountNote").textContent="";
  return;
 }
 $("#settingsPlanName").textContent=usage.plan_name||usage.plan_code||"—";
 $("#settingsUsageSummary").textContent=(Number(usage.site_count)||0)+" / "+usage.max_sites+" sites · "+(Number(usage.product_count)||0)+" / "+usage.max_products+" produits · "+formatBytes(usage.site_html_bytes)+" / "+formatBytes(usage.max_total_site_html_bytes);
 const account=usage.account_status||state.organization?.account_status||"pending";
 $("#settingsAccountStatus").textContent=({pending:"En attente de validation",active:"Actif",suspended:"Suspendu"})[account]||account;
 $("#settingsAccountNote").textContent=account==="active"?"Ton compte est actif. Les boutiques restent en brouillon jusqu’à la publication manuelle.":account==="suspended"?"Le compte est suspendu.": "Vérifie l’état du compte avant toute publication.";
}
function fillSiteSelects(){["productSiteSelect","inventorySiteFilter","orderSiteFilter","siteEditorSiteSelect","managementRequestSiteSelect"].forEach(id=>{const select=$("#"+id);if(!select)return;const prev=select.value;select.replaceChildren();if(!["productSiteSelect","siteEditorSiteSelect","managementRequestSiteSelect"].includes(id)){const all=node("option","","Tous les sites");all.value="";select.appendChild(all);}state.sites.forEach(site=>{const o=node("option","",site.name);o.value=site.id;select.appendChild(o);});if([...select.options].some(o=>o.value===prev))select.value=prev;else if(["siteEditorSiteSelect","managementRequestSiteSelect","productSiteSelect"].includes(id)&&state.sites.length)select.value=state.sites[0].id;if(!state.sites.length){const o=node("option","","Crée d’abord un site");o.value="";select.appendChild(o);select.disabled=true;}else select.disabled=false;});}
function createTable(headers){const table=node("table","data-table"),head=node("thead"),row=node("tr");headers.forEach(t=>row.appendChild(node("th","",t)));head.appendChild(row);table.appendChild(head);table.appendChild(node("tbody"));return table;}
function setTableContent(wrapper,table,exists,message){wrapper.replaceChildren();wrapper.appendChild(exists?table:node("div","empty-state",message));}
function statusName(status){return({draft:"Brouillon",published:"Publié",paused:"Suspendu",pending:"À traiter",confirmed:"Confirmée",preparing:"En préparation",shipped:"Expédiée",completed:"Terminée",cancelled:"Annulée",accepted:"Acceptée",in_progress:"En cours",declined:"Refusée",not_ordered:"À acheter",ordered:"Commandé",received:"Reçu",unavailable:"Indisponible",returned:"Retourné",awaiting_payment:"Paiement attendu",paid:"Payé",cash_on_delivery:"Paiement à la livraison",refunded:"Remboursé"})[status]||status;}
function statusPill(status){return node("span","status-pill status-"+status,statusName(status));}
function empty(message){return node("div","empty-state",message);}
function renderOverview(){
 const active=state.products.filter(p=>p.is_active&&!p.is_demo);
 const low=active.filter(p=>p.fulfillment_mode==="stocked"&&p.stock_quantity<=p.low_stock_threshold);
 const stale=active.filter(p=>!sourceIsFresh(p));
 const open=state.orders.filter(o=>["pending","confirmed","preparing"].includes(o.status));
 const value=state.orders.filter(o=>o.status!=="cancelled").reduce((n,o)=>n+Number(o.total||0),0);
 $("#statSites").textContent=String(state.sites.length);
 $("#statPublished").textContent=state.sites.filter(s=>s.status==="published").length+" en ligne";
 $("#statProducts").textContent=String(active.length);
 $("#statLowStock").textContent=low.length+" stock faible · "+stale.length+" source(s) à vérifier";
 $("#lowStockNavCount").textContent=String(low.length+stale.length);
 $("#statOrders").textContent=String(open.length);
 $("#statRevenue").textContent=formatMoney(value,"XOF");
 const list=$("#lowStockList");list.replaceChildren();
 const attention=[...stale.map(p=>({p,reason:"Source ou prix à vérifier",warn:true})),...low.filter(p=>sourceIsFresh(p)).map(p=>({p,reason:"Stock faible",warn:true}))];
 if(!attention.length)list.appendChild(empty("Aucun prix source expiré ni stock physique bas."));
 attention.slice(0,8).forEach(({p,reason})=>{
  const site=state.sites.find(s=>s.id===p.site_id),row=node("div","low-stock-row"),thumb=node("span","mini-thumb",(p.name||"P").charAt(0).toUpperCase()),copy=node("div","item-copy");
  if(p.image_url&&/^https?:\/\//i.test(p.image_url)){const img=node("img");img.src=p.image_url;img.alt="";img.loading="lazy";img.onerror=()=>img.remove();thumb.replaceChildren(img);}
  append(copy,node("strong","",p.name),node("small","",(site?.name||"Boutique")+" · "+reason));
  append(row,thumb,copy,node("span","stock-alert",p.fulfillment_mode==="stocked"?p.stock_quantity+" en stock":(sourceIsFresh(p)?"Prix à jour":"À vérifier")));
  list.appendChild(row);
 });
 const recent=$("#recentOrdersList");recent.replaceChildren();
 if(!state.orders.length)recent.appendChild(empty("Les commandes des boutiques publiées s’afficheront ici."));
 state.orders.slice(0,6).forEach(o=>{const row=node("div","recent-order-row"),thumb=node("span","mini-thumb","#"+String(o.order_number||"—").slice(-3)),copy=node("div","item-copy"),site=state.sites.find(s=>s.id===o.site_id);append(copy,node("strong","",o.customer_name||"Client"),node("small","",(site?.name||"Boutique")+" · "+formatDate(o.created_at)));append(row,thumb,copy,node("span","money-label",formatMoney(o.total,o.currency||"XOF")));recent.appendChild(row);});
}
function safeEditorUrl(value,label){const text=String(value||"").trim();if(!text)return "";try{const url=new URL(text);if(["https:","http:"].includes(url.protocol))return url.href;}catch{}throw new Error("L’URL du champ « "+label+" » doit commencer par https:// ou http://.");}
function replaceStoreData(html,data){const marker="window.SAMA_STORE_DATA=",i=html.indexOf(marker);if(i<0)throw new Error("Données du site absentes. Réimporte un export HTML de Sama Studio.");const start=i+marker.length,end=html.indexOf(";(",start);if(end<0)throw new Error("Structure HTML invalide. Réimporte le site depuis le créateur Sama Studio.");return html.slice(0,start)+JSON.stringify(data).replace(/</g,"\\u003c")+html.slice(end);}
async function loadSiteEditor(siteId){const site=state.sites.find(s=>s.id===siteId);if(!site)return;state.editingSiteId=siteId;$("#siteEditorLoadState").textContent="Chargement du contenu…";$("#siteEditorSiteSelect").value=siteId;try{const {data,error}=await state.supabase.from("sites").select("html_content").eq("id",siteId).eq("organization_id",state.organization.id).single();if(error)throw error;const store=parseExportedHtml(data.html_content||"");if(!store)throw new Error("Ce site n’a pas de fiche modifiable. Réimporte un export HTML de Sama Studio.");state.editingHtml=data.html_content;const b=store.business||{},d=store.design||{};const set=(id,value)=>{const el=$("#"+id);if(el)el.value=value==null?"":String(value);};set("editBusinessName",b.name);set("editHeadline",b.headline);set("editCity",b.city);set("editAddress",b.address);set("editPhone",b.phone);set("editWhatsapp",b.whatsapp);set("editEmail",b.email);set("editLogoUrl",b.logoUrl);set("editHeroImage",store.template?.heroImage);set("editDescription",b.description);set("editHours",b.hours);set("editDelivery",b.delivery);set("editInstagram",b.instagram);set("editFacebook",b.facebook);set("editPrimaryColor",/^#[0-9a-f]{6}$/i.test(d.primaryColor||"")?d.primaryColor:"#17633d");const canManage=["owner","admin"].includes(state.role);$("input,textarea,button",$("#siteEditorForm")).forEach(el=>{el.disabled=!canManage;});$("#saveAndPublishSiteBtn").disabled=!canManage;$("#siteEditorLoadState").textContent=site.name+" · "+reviewStatusName(site.review_status)+(site.review_note?" · "+site.review_note:"")+(site.published_url?" · version précédente en ligne":"");$("#siteEditorSaveHint").textContent=canManage?"Les modifications seront publiques après publication.": "Consultation seule : demande au propriétaire ou à un administrateur de modifier le site.";}catch(e){$("#siteEditorLoadState").textContent=friendlyError(e);$("#siteEditorSaveHint").textContent="Impossible de charger cet éditeur.";if(!["owner","admin"].includes(state.role))$("#siteEditorForm").querySelectorAll("input,textarea,button").forEach(el=>el.disabled=true);}}
async function openSiteManager(site){switchView("manage");$("#siteEditorSiteSelect").value=site.id;await loadSiteEditor(site.id);}
async function persistSiteSettings(requestReview=true){if(!["owner","admin"].includes(state.role))throw new Error("Seuls le propriétaire ou un administrateur peuvent modifier le contenu du site.");const siteId=state.editingSiteId;if(!siteId)throw new Error("Choisis d’abord un site à modifier.");const {data:current,error:loadError}=await state.supabase.from("sites").select("html_content").eq("id",siteId).eq("organization_id",state.organization.id).single();if(loadError)throw loadError;const store=parseExportedHtml(current.html_content||"");if(!store)throw new Error("Le fichier HTML ne contient pas les données modifiables de Sama Studio.");const b=store.business||(store.business={});b.name=$("#editBusinessName").value.trim();b.headline=$("#editHeadline").value.trim();b.city=$("#editCity").value.trim();b.address=$("#editAddress").value.trim();b.phone=$("#editPhone").value.trim();b.whatsapp=$("#editWhatsapp").value.trim();b.email=$("#editEmail").value.trim();b.logoUrl=safeEditorUrl($("#editLogoUrl").value,"Logo");b.description=$("#editDescription").value.trim();b.hours=$("#editHours").value.trim();b.delivery=$("#editDelivery").value.trim();b.instagram=safeEditorUrl($("#editInstagram").value,"Instagram");b.facebook=safeEditorUrl($("#editFacebook").value,"Facebook");store.template=store.template||{};store.template.heroImage=safeEditorUrl($("#editHeroImage").value,"image principale");if(!b.name||!b.headline)throw new Error("Le nom de l’entreprise et l’accroche sont obligatoires.");store.design=store.design||{};store.design.primaryColor=$("#editPrimaryColor").value;if(!/^#[0-9a-f]{6}$/i.test(store.design.primaryColor))store.design.primaryColor="#17633d";const html=replaceStoreData(current.html_content,store);if(html.length>2900000)throw new Error("Le fichier modifié dépasse la limite de 2,9 Mo.");const reviewPatch=requestReview?{review_status:"pending",submitted_at:new Date().toISOString(),review_note:null,reviewed_by:null,reviewed_at:null}:{review_status:"draft",submitted_at:null,review_note:null,reviewed_by:null,reviewed_at:null};const {data:updated,error}=await state.supabase.from("sites").update({html_content:html,name:b.name,...reviewPatch}).eq("id",siteId).eq("organization_id",state.organization.id).select("id").single();if(error)throw error;if(!updated)throw new Error("Aucune modification n’a été enregistrée.");state.editingHtml=html;state.editingSiteId=siteId;await reloadData();let mailSent=false;if(requestReview){try{const emailResult=await state.supabase.functions.invoke("notify-site-review",{body:{site_id:siteId}});mailSent=!emailResult.error&&Boolean(emailResult.data?.sent);}catch(emailError){mailSent=false;}}$("#siteEditorSaveHint").textContent=requestReview?"Modifications enregistrées · en attente de validation SAMA Studio.":"Brouillon enregistré · la version en ligne reste inchangée.";if(requestReview)toast(mailSent?"Modifications enregistrées. La demande de validation et l’e-mail ont été envoyés à SAMA Studio.":"Modifications enregistrées. La demande est dans la file de validation ; l’e-mail automatique reste à configurer.");else toast("Brouillon enregistré. La version actuellement en ligne reste inchangée. Envoie les modifications à SAMA Studio pour les publier.");return state.sites.find(s=>s.id===siteId)||{id:siteId,name:b.name};}
async function handleSiteEditorSubmit(event){event.preventDefault();if(!$("#siteEditorForm").reportValidity())return;const button=$("#saveSiteSettingsBtn");setBusy(button,true,"Sauvegarde…");try{await persistSiteSettings(false);}catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}}
async function saveAndPublishEditedSite(){if(!$("#siteEditorForm").reportValidity())return;const button=$("#saveAndPublishSiteBtn");setBusy(button,true,"Enregistrement…");try{await persistSiteSettings(false);const site=state.sites.find(item=>item.id===state.editingSiteId);if(!site)throw new Error("Boutique introuvable après enregistrement.");await publishSite(site,button);}catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}}
async function reloadReviewQueue(){
 if(!state.isSamaAdmin)return;
 const [siteResult,noticeResult]=await Promise.all([
  state.supabase.from("sites").select("id,organization_id,name,slug,template_id,status,review_status,review_note,submitted_at,created_at,updated_at,published_url,created_by").not("submitted_at","is",null).neq("status","published").in("review_status",["pending","approved","changes_requested"]).order("submitted_at",{ascending:false}).limit(200),
  state.supabase.from("site_review_notifications").select("id,recipient_id,site_id,organization_id,event_type,title,message,created_at,read_at").eq("recipient_id",state.user.id).is("read_at",null).order("created_at",{ascending:false}).limit(100)
 ]);
 if(siteResult.error)throw siteResult.error;
 if(noticeResult.error)throw noticeResult.error;
 const sites=siteResult.data||[],notifications=noticeResult.data||[];
 const orgIds=[...new Set(sites.map(s=>s.organization_id))],siteIds=[...new Set(sites.map(s=>s.id))];
 let organizations=[],products=[],profiles=[];
 if(orgIds.length){
  const result=await state.supabase.from("organizations").select("id,name,slug,subscription_plan,subscription_status,account_status,owner_id").in("id",orgIds);
  if(result.error)throw result.error;organizations=result.data||[];
 }
 if(siteIds.length){
  const result=await state.supabase.from("products").select("id,site_id,organization_id,name,category,price,price_label,stock_quantity,is_demo,is_active,image_url").in("site_id",siteIds).order("name",{ascending:true});
  if(result.error)throw result.error;products=result.data||[];
 }
 const contactIds=[...new Set(sites.flatMap(site=>[site.created_by,organizations.find(org=>org.id===site.organization_id)?.owner_id]).filter(Boolean))];
 if(contactIds.length){
  const result=await state.supabase.from("profiles").select("id,email,full_name").in("id",contactIds);
  if(result.error)throw result.error;profiles=result.data||[];
 }
 state.reviewProducts=products;
 state.reviewSites=sites.map(site=>{
  const org=organizations.find(item=>item.id===site.organization_id)||null;
  return {
   ...site,
   organization:org,
   contact:profiles.find(profile=>profile.id===site.created_by)||profiles.find(profile=>profile.id===org?.owner_id)||null,
   products:products.filter(product=>product.site_id===site.id)
  };
 });
 state.reviewNotifications=notifications;
 $("#reviewNavCount").textContent=String(state.reviewSites.filter(site=>site.review_status==="pending").length+notifications.length);
 renderReviewRequests();
}
function renderReviewRequests(){
 const wrap=$("#reviewRequestsTableWrap");if(!wrap)return;wrap.replaceChildren();
 const items=(state.reviewSites||[]).filter(site=>site.review_status==="pending"||site.review_status==="changes_requested"||(site.review_status==="approved"&&site.status!=="published"));
 const badge=$("#reviewCountBadge");
 if(badge)badge.textContent=items.length+" site"+(items.length===1?"":"s")+" à traiter";
 if(state.reviewNotifications?.length){
  const noticeWrap=node("div","review-notifications");
  const heading=node("div","review-notifications-heading","Notifications non lues");
  noticeWrap.appendChild(heading);
  state.reviewNotifications.slice(0,4).forEach(notification=>{
   const line=node("div","review-notification");
   append(line,node("strong","",notification.title),node("span","",notification.message),node("small","",formatDate(notification.created_at)));
   noticeWrap.appendChild(line);
  });
  const mark=node("button","btn btn-outline","Marquer les notifications comme lues");mark.type="button";
  mark.addEventListener("click",async()=>{
   mark.disabled=true;
   try{
    const ids=state.reviewNotifications.map(n=>n.id);
    const {error}=await state.supabase.from("site_review_notifications").update({read_at:new Date().toISOString()}).in("id",ids).eq("recipient_id",state.user.id);
    if(error)throw error;
    state.reviewNotifications=[];toast("Notifications marquées comme lues.");await reloadReviewQueue();
   }catch(e){toast(friendlyError(e),true);mark.disabled=false;}
  });
  noticeWrap.appendChild(mark);wrap.appendChild(noticeWrap);
 }
 if(!items.length){wrap.appendChild(empty("Aucun site en attente de validation. Les nouvelles demandes apparaîtront automatiquement ici."));return;}
 const table=createTable(["Entreprise / site","Catalogue","Formule / compte","Envoyé le","État","Action"]),tbody=$("tbody",table);
 items.forEach(site=>{
  const row=node("tr"),siteCell=node("td"),productsCell=node("td"),accountCell=node("td"),dateCell=node("td","",formatDate(site.submitted_at)),statusCell=node("td"),actions=node("td","action-cell");
  append(siteCell,node("strong","",site.organization?.name||"Entreprise"),node("small","",site.name+" · "+site.slug),node("small","",(site.template_id||"modèle")+" · "+site.products.length+" produits"));if(site.contact){siteCell.appendChild(node("small","",(site.contact.full_name||"Contact")+" · "+(site.contact.email||"e-mail non renseigné")));}
  const verified=site.products.filter(product=>product.is_active&&!product.is_demo);
  const demos=site.products.filter(product=>product.is_demo).length;
  if(site.products.length){
   productsCell.appendChild(node("strong","",verified.length+" produit(s) confirmé(s)"));
   productsCell.appendChild(node("small","",site.products.slice(0,3).map(product=>product.name+" ("+(Number(product.stock_quantity)||0)+" dispo.)").join(", ")+(site.products.length>3?"…":"")));
   if(demos)productsCell.appendChild(node("small","",demos+" exemple(s) à vérifier"));if(!verified.some(product=>Number(product.stock_quantity)>0))productsCell.appendChild(node("small","", "Aucune disponibilité confirmée : approbation bloquée."));
  }else productsCell.appendChild(node("span","","Aucun produit"));
  append(accountCell,node("strong","",({free:"Découverte",starter:"Essentiel",pro:"Professionnel"})[site.organization?.subscription_plan]||site.organization?.subscription_plan||"—"),node("small","",({pending:"Compte à activer",active:"Compte actif",suspended:"Compte suspendu"})[site.organization?.account_status]||site.organization?.account_status||"État inconnu"));
  statusCell.appendChild(reviewStatusPill(site.review_status));
  if(site.review_note)statusCell.appendChild(node("small","",site.review_note));
  if(site.published_url&&/^https:\/\//i.test(site.published_url)){
   const link=node("a","","Version en ligne ↗");link.href=site.published_url;link.target="_blank";link.rel="noopener noreferrer";link.style.display="block";link.style.marginTop="5px";link.style.color="#34794b";link.style.fontSize="10px";siteCell.appendChild(link);
  }
  if(site.review_status==="pending"){
   const approve=node("button","btn btn-primary","Approuver et publier");approve.type="button";approve.addEventListener("click",()=>handleSiteReviewDecision(site,"approved",approve));
   const changes=node("button","btn btn-outline","Demander corrections");changes.type="button";changes.style.marginTop="5px";changes.addEventListener("click",()=>handleSiteReviewDecision(site,"changes_requested",changes));
   const reject=node("button","btn btn-outline","Refuser");reject.type="button";reject.style.marginTop="5px";reject.addEventListener("click",()=>handleSiteReviewDecision(site,"rejected",reject));
   append(actions,approve,changes,reject);
  }else if(site.review_status==="approved"&&site.status!=="published"){
   const publish=node("button","btn btn-primary","Publier maintenant");publish.type="button";publish.addEventListener("click",()=>publishReviewedSite(site,publish));actions.appendChild(publish);
  }else{
   actions.appendChild(node("span","muted-small","En attente d’une mise à jour du client."));
  }
  append(row,siteCell,productsCell,accountCell,dateCell,statusCell,actions);tbody.appendChild(row);
 });
 const container=node("div","table-wrap");container.appendChild(table);wrap.appendChild(container);
}
async function handleSiteReviewDecision(site,decision,button){
 if(!state.isSamaAdmin)return toast("Accès réservé à SAMA Studio.",true);
 let note="";
 if(decision==="approved"&&!confirm("Approuver « "+site.name+" » et le publier sur Cloudflare ? Le compte du client sera activé après l’approbation."))return;
 if(decision==="changes_requested"||decision==="rejected"){
  note=String(prompt(decision==="changes_requested"?"Indique au client les corrections à apporter :":"Indique brièvement le motif du refus :",site.review_note||"")||"").trim();
  if(!note)return toast("Ajoute une explication pour que le client sache quoi corriger.",true);
 }
 setBusy(button,true,"Traitement…");
 try{
  const {data,error}=await state.supabase.rpc("review_site_submission",{p_site_id:site.id,p_decision:decision,p_note:note||null});
  if(error)throw error;
  if(decision==="approved"){
   toast("Site approuvé. Publication en cours…");
   await publishReviewedSite({...site,...data},button,true);
  }else{
   toast(decision==="changes_requested"?"Corrections demandées. Le client pourra modifier son site puis le renvoyer.":"Demande refusée. Le client pourra consulter le motif dans son espace.");
   await reloadReviewQueue();
  }
 }catch(e){toast(friendlyError(e),true);}
 finally{setBusy(button,false);}
}
async function publishReviewedSite(site,button,alreadyBusy=false){
 if(!state.isSamaAdmin)return toast("Seul SAMA Studio peut activer la publication.",true);
 if(!alreadyBusy)setBusy(button,true,"Publication…");
 try{
  const {data,error}=await state.supabase.functions.invoke("publish-site",{body:{site_id:site.id}});
  if(error)throw error;
  if(data?.status==="published"&&data.url)toast("Site publié : "+data.url);
  else if(data?.status==="deploying")toast(data.message||"La publication est en cours. Actualise la liste dans quelques instants.");
  else if(data?.error)throw new Error(data.error);
  await reloadReviewQueue();
  if(state.organization)await reloadData();
 }catch(e){
  toast("La validation est enregistrée, mais la publication a échoué : "+friendlyError(e),true);
  await reloadReviewQueue();
 }finally{if(!alreadyBusy)setBusy(button,false);}
}
function renderManagementRequests(){const wrap=$("#siteManagementRequestsWrap");if(!wrap)return;wrap.replaceChildren();if(!state.managementRequests.length){wrap.appendChild(empty("Aucune demande d’accompagnement pour le moment."));return;}state.managementRequests.forEach(request=>{const row=node("div","management-request-row"),copy=node("div","item-copy"),site=state.sites.find(s=>s.id===request.site_id);append(copy,node("strong","",site?.name||"Site"),node("small","",formatDate(request.created_at)+" · "+({pending:"En attente de réponse",accepted:"Prise en charge acceptée",in_progress:"Prise en charge en cours",completed:"Prise en charge terminée",declined:"Demande refusée",cancelled:"Demande retirée"})[request.status]||request.status));if(request.message)copy.appendChild(node("p","management-request-message",request.message));row.appendChild(copy);row.appendChild(statusPill(request.status));if(["pending","accepted","in_progress"].includes(request.status)&&request.requested_by===state.user?.id&&["owner","admin"].includes(state.role)){const active=request.status!=="pending",cancel=node("button","delete-button",active?"Retirer l’accès à SAMA Studio":"Retirer la demande");cancel.type="button";cancel.addEventListener("click",async()=>{if(!confirm(active?"Retirer maintenant l’accès de gestion de SAMA Studio à l’espace de cette entreprise ?":"Retirer cette demande d’accompagnement ?"))return;cancel.disabled=true;try{const {error}=await state.supabase.rpc("revoke_site_management_request",{p_request_id:request.id});if(error)throw error;toast(active?"Prise en charge retirée et accès révoqué.":"Demande retirée.");await showWorkspace();}catch(e){toast(friendlyError(e),true);cancel.disabled=false;}});row.appendChild(cancel);}wrap.appendChild(row);});}
async function reloadSupportRequests(){if(!state.isSamaAdmin)return;const {data,error}=await state.supabase.from("site_management_requests").select("id,organization_id,site_id,requested_by,message,status,created_at,updated_at,handled_by,previous_membership_role").order("created_at",{ascending:false}).limit(200);if(error)throw error;const requests=data||[],orgIds=[...new Set(requests.map(r=>r.organization_id))],siteIds=[...new Set(requests.map(r=>r.site_id))];let organizations=[],sites=[];if(orgIds.length){const result=await state.supabase.from("organizations").select("id,name,slug").in("id",orgIds);if(result.error)throw result.error;organizations=result.data||[];}if(siteIds.length){const result=await state.supabase.from("sites").select("id,name,slug,published_url,status").in("id",siteIds);if(result.error)throw result.error;sites=result.data||[];}state.supportRequests=requests.map(r=>({...r,organization:organizations.find(o=>o.id===r.organization_id)||null,site:sites.find(s=>s.id===r.site_id)||null}));const pending=requests.filter(r=>r.status==="pending").length;$("#supportNavCount").textContent=String(pending);$("#supportCountBadge").textContent=requests.length+" demande"+(requests.length===1?"":"s");renderSupportRequests();}
function renderSupportRequests(){const wrap=$("#supportRequestsTableWrap");if(!wrap)return;const items=state.supportRequests||[];if(!items.length){wrap.replaceChildren(empty("Aucune demande d’accompagnement reçue pour le moment."));return;}const table=createTable(["Entreprise / site","Demande du client","Date","Statut","Action"]),tbody=$("tbody",table);items.forEach(request=>{const row=node("tr"),siteCell=node("td"),messageCell=node("td"),dateCell=node("td","",formatDate(request.created_at)),statusCell=node("td"),actions=node("td","action-cell");append(siteCell,node("strong","",request.organization?.name||"Entreprise"),node("small","",request.site?.name||"Site"));if(request.site?.published_url){const link=node("a","","Ouvrir le site ↗");link.href=request.site.published_url;link.target="_blank";link.rel="noopener noreferrer";link.style.display="block";link.style.marginTop="6px";link.style.color="#34794b";link.style.fontSize="10px";siteCell.appendChild(link);}messageCell.textContent=request.message||"Aucun détail fourni.";statusCell.appendChild(statusPill(request.status));const status=request.status;if(status==="pending"){const accept=node("button","btn btn-primary","Accepter");accept.type="button";accept.addEventListener("click",()=>handleSupportRequestAction(request,"accepted",accept));const decline=node("button","btn btn-outline","Refuser");decline.type="button";decline.style.marginLeft="5px";decline.addEventListener("click",()=>handleSupportRequestAction(request,"declined",decline));append(actions,accept,decline);}else if(status==="accepted"){const start=node("button","btn btn-outline","Démarrer");start.type="button";start.addEventListener("click",()=>handleSupportRequestAction(request,"in_progress",start));const finish=node("button","btn btn-primary","Terminer la prise en charge");finish.type="button";finish.style.marginLeft="5px";finish.addEventListener("click",()=>handleSupportRequestAction(request,"completed",finish));append(actions,start,finish);}else if(status==="in_progress"){const finish=node("button","btn btn-primary","Terminer la prise en charge");finish.type="button";finish.addEventListener("click",()=>handleSupportRequestAction(request,"completed",finish));actions.appendChild(finish);}else actions.appendChild(node("span","muted-small","Aucune action"));append(row,siteCell,messageCell,dateCell,statusCell,actions);tbody.appendChild(row);});wrap.replaceChildren();const container=node("div","table-wrap");container.appendChild(table);wrap.appendChild(container);}
async function handleSupportRequestAction(request,nextStatus,button){if(!state.isSamaAdmin)return toast("Accès réservé à SAMA Studio.",true);if(nextStatus==="accepted"&&!confirm("Accepter la prise en charge ? Le compte SAMA Studio sera ajouté comme administrateur de l’entreprise et pourra consulter ses sites, produits et commandes jusqu’à la révocation de l’accès."))return; if(nextStatus==="completed"&&!confirm("Terminer la prise en charge ? L’accès temporaire de SAMA Studio à cette entreprise sera retiré."))return;setBusy(button,true,"Traitement…");try{const {data,error}=await state.supabase.rpc("respond_site_management_request",{p_request_id:request.id,p_status:nextStatus});if(error)throw error;toast(({accepted:"Demande acceptée. Accès de gestion accordé.",declined:"Demande refusée.",in_progress:"Prise en charge marquée comme en cours.",completed:"Prise en charge terminée. Accès de gestion retiré."})[nextStatus]||"Demande mise à jour.");await showWorkspace();}catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}}
async function onManagementRequestSubmit(event){event.preventDefault();if(!state.organization)return toast("Aucun espace entreprise actif.",true);if(!["owner","admin"].includes(state.role))return toast("Seul le propriétaire ou un administrateur peut demander une prise en charge.",true);const siteId=$("#managementRequestSiteSelect").value,site=state.sites.find(s=>s.id===siteId),message=$("#managementRequestMessage").value.trim(),button=$("#managementRequestSubmitBtn");if(!site)return toast("Choisis le site concerné.",true);setBusy(button,true,"Envoi…");try{const {error}=await state.supabase.from("site_management_requests").insert({organization_id:state.organization.id,site_id:site.id,requested_by:state.user.id,message,status:"pending"});if(error)throw error;$("#managementRequestMessage").value="";toast("Demande enregistrée. Elle doit être confirmée par SAMA Studio avant toute prise en charge.");await reloadData();}catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}}
function reviewStatusName(status){return({draft:"Brouillon",pending:"En attente de validation",approved:"Approuvé",changes_requested:"Corrections demandées",rejected:"Refusé"})[status]||status||"Brouillon";}
function reviewStatusPill(status){return node("span","status-pill review-status-"+(status||"draft"),reviewStatusName(status));}
async function submitSiteForReview(site,button){
 if(!["owner","admin"].includes(state.role))return toast("Seul le propriétaire ou un administrateur peut demander une validation.",true);
 if(!site?.id)return toast("Site introuvable.",true);
 setBusy(button,true,"Envoi…");
 try{
  const {error}=await state.supabase.from("sites").update({review_status:"pending",submitted_at:new Date().toISOString(),review_note:null,reviewed_by:null,reviewed_at:null}).eq("id",site.id).eq("organization_id",state.organization.id).select("id").single();
  if(error)throw error;
  toast("Demande envoyée à SAMA Studio. Le site ne sera publié qu’après validation.");
  await reloadData();
 }catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}
}
function renderSites(){
 const wrapper=$("#sitesTableWrap"),table=createTable(["Boutique","Adresse publique","État","Modifiée le","Actions"]),tbody=$("tbody",table);
 state.sites.forEach(site=>{
  const row=node("tr"),details=node("td"),address=node("td"),status=node("td"),created=node("td","",formatDate(site.updated_at||site.created_at)),actions=node("td","action-cell");
  append(details,node("strong","",site.name),node("small","",site.slug+" · "+(site.template_id||"modèle")));
  if(site.published_url&&/^https:\/\//i.test(site.published_url)){
   const link=node("a","",site.published_url.replace(/^https?:\/\//,""));link.href=site.published_url;link.target="_blank";link.rel="noopener noreferrer";link.style.color="#34794b";link.style.fontWeight="750";address.appendChild(link);
  }else address.appendChild(node("span","","En attente de validation ou de publication"));
  status.appendChild(statusPill(site.status));
  if(site.review_status&&site.status!=="published")status.appendChild(reviewStatusPill(site.review_status));
  if(site.review_note&&site.status!=="published")status.appendChild(node("small","",site.review_note));
  const manage=node("button","btn btn-outline","Modifier");manage.type="button";manage.disabled=![ "owner","admin"].includes(state.role);manage.addEventListener("click",()=>openSiteManager(site));
  append(actions,manage);
  const trialValid=state.organization?.subscription_status==="trial"&&Boolean(state.organization?.trial_ends_at)&&new Date(state.organization.trial_ends_at).getTime()>Date.now();
  const subscriptionValid=state.organization?.subscription_status==="active"||trialValid;
  const canSelfPublish=["owner","admin"].includes(state.role)&&state.organization?.account_status==="active"&&subscriptionValid;
  if(site.status==="published"){
   const live=node("button","btn btn-outline","En ligne ↗");live.type="button";live.addEventListener("click",()=>{if(site.published_url)window.open(site.published_url,"_blank","noopener,noreferrer");});append(actions,live);
  }else if(canSelfPublish){
   const publish=node("button","btn btn-primary","Publier la boutique");publish.type="button";publish.addEventListener("click",()=>publishSite(site,publish));append(actions,publish);
   if(site.review_status==="pending")actions.appendChild(node("small","muted-small","Publication autonome disponible"));
  }else if(site.review_status==="pending"){
   const waiting=node("button","btn btn-outline","En validation");waiting.type="button";waiting.disabled=true;append(actions,waiting);
  }else if(site.review_status==="changes_requested"||site.review_status==="draft"||!site.review_status){
   const submit=node("button","btn btn-primary","Demander validation");submit.type="button";submit.disabled=![ "owner","admin"].includes(state.role);submit.addEventListener("click",()=>submitSiteForReview(site,submit));append(actions,submit);
  }else if(site.review_status==="approved"&&site.status!=="published"){
   const approved=node("button","btn btn-outline","Approuvé · activation");approved.type="button";approved.disabled=true;append(actions,approved);
  }
  tbody.appendChild(row);
 });
 setTableContent(wrapper,table,state.sites.length>0,"Aucune boutique pour le moment. Clique sur « Créer les boutiques manquantes » pour préparer les dix univers SAMA.");
 $("#siteCountBadge").textContent=state.sites.length+" site"+(state.sites.length===1?"":"s");
}
async function downloadSite(site){const {data,error}=await state.supabase.from("sites").select("html_content").eq("id",site.id).single();if(error)return toast(friendlyError(error),true);const url=URL.createObjectURL(new Blob([data.html_content],{type:"text/html;charset=utf-8"})),a=node("a");a.href=url;a.download=escapeSlug(site.name)+"-site.html";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function publishSite(site,button){if(!["owner","admin"].includes(state.role))return toast("Seuls le propriétaire ou l’administrateur peuvent publier.",true);setBusy(button,true,"Publication…");toast("Préparation et mise en ligne de ton site…");try{const {data,error}=await state.supabase.functions.invoke("publish-site",{body:{site_id:site.id}});if(error)throw error;if(data?.status==="deploying")toast(data.message||"Le déploiement est encore en cours. Réessaie dans quelques instants.");else if(data?.status==="published"&&data.url)toast("Site publié : "+data.url);else if(data?.error)throw new Error(data.error);await reloadData();}catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}}
function calculateSalePrice(sourcePrice,rate,shipping,otherCosts,margin){
 const values=[Number(sourcePrice),Number(rate),Number(shipping),Number(otherCosts),Number(margin)];
 if(!values.every(Number.isFinite)||values[0]<=0||values[1]<=0||values[2]<0||values[3]<0||values[4]<0||values[4]>500)return null;
 const base=values[0]*values[1]+values[2]+values[3];
 return Math.ceil((base*(1+values[4]/100))/100)*100;
}
function sourceIsFresh(product){const t=product?.source_checked_at?new Date(product.source_checked_at).getTime():0;return Boolean(product?.source_url&&/^https?:\/\//i.test(product.source_url)&&product.source_price>0&&t>0&&t>Date.now()-7*24*60*60*1000);}
function currencySelect(current){const sel=node("select","product-edit-input");[["XOF","XOF"],["EUR","EUR"],["USD","USD"],["GMD","GMD"],["GNF","GNF"],["MAD","MAD"]].forEach(([v,label])=>{const o=node("option","",label);o.value=v;o.selected=v===(current||"XOF");sel.appendChild(o);});return sel;}
function labeledControl(labelText,control,wide=false){const label=node("label",wide?"fulfillment-field wide-field":"fulfillment-field");label.appendChild(node("span","",labelText));label.appendChild(control);return label;}
function renderProducts(){
 const siteFilter=$("#inventorySiteFilter").value,q=$("#inventorySearch").value.trim().toLocaleLowerCase("fr");
 const items=state.products.filter(p=>(!siteFilter||p.site_id===siteFilter)&&[p.name,p.sku,p.category,p.source_store_name,p.source_url].join(" ").toLocaleLowerCase("fr").includes(q));
 const wrapper=$("#productsTableWrap"),table=createTable(["Produit","Source en ligne","Coût source estimé","Marge / vente","Mode & disponibilité","État","Actions"]),tbody=$("tbody",table);
 items.forEach(p=>{
  const row=node("tr"),productCell=node("td"),sourceCell=node("td"),costCell=node("td"),marginCell=node("td"),modeCell=node("td"),stateCell=node("td"),actions=node("td","action-cell");
  const name=node("input","product-edit-input product-name");name.value=p.name||"";name.setAttribute("aria-label","Nom du produit");
  const sku=node("input","product-edit-input");sku.value=p.sku||"";sku.placeholder="SKU";sku.setAttribute("aria-label","Référence SKU");
  const category=node("input","product-edit-input");category.value=p.category||"Catalogue";category.placeholder="Catégorie";category.setAttribute("aria-label","Catégorie");
  const description=node("input","product-edit-input");description.value=p.description||"";description.placeholder="Description";description.maxLength=1000;description.setAttribute("aria-label","Description");
  const image=node("input","product-edit-input");image.type="url";image.value=p.image_url||"";image.placeholder="URL image";image.setAttribute("aria-label","URL image");
  append(productCell,name,sku,category,description,image);
  const sourceName=node("input","product-edit-input");sourceName.value=p.source_store_name||"";sourceName.placeholder="Nom du vendeur";sourceName.setAttribute("aria-label","Boutique source");
  const sourceUrl=node("input","product-edit-input");sourceUrl.type="url";sourceUrl.value=p.source_url||"";sourceUrl.placeholder="https://…";sourceUrl.setAttribute("aria-label","Lien source du produit");
  const sourceLink=node("a","source-reference-link",p.source_url?"Ouvrir le produit ↗":"Lien source à ajouter");sourceLink.href=p.source_url||"#";sourceLink.target="_blank";sourceLink.rel="noopener noreferrer";
  sourceUrl.addEventListener("input",()=>{sourceLink.href=sourceUrl.value||"#";sourceLink.textContent=sourceUrl.value?"Ouvrir le produit ↗":"Lien source à ajouter";});
  append(sourceCell,sourceName,sourceUrl,sourceLink);
  const srcPrice=node("input","product-edit-input small-number");srcPrice.type="number";srcPrice.min="0.01";srcPrice.step="0.01";srcPrice.value=String(p.source_price??"");srcPrice.setAttribute("aria-label","Prix fournisseur");
  const srcCurrency=currencySelect(p.source_currency||"XOF");
  const exchange=node("input","product-edit-input small-number");exchange.type="number";exchange.min="0.0001";exchange.step="0.0001";exchange.value=String(p.source_exchange_rate??1);exchange.setAttribute("aria-label","Taux de conversion en XOF");
  const sourceShip=node("input","product-edit-input small-number");sourceShip.type="number";sourceShip.min="0";sourceShip.step="1";sourceShip.value=String(p.source_shipping_xof??0);sourceShip.setAttribute("aria-label","Frais de livraison source en XOF");
  const otherCosts=node("input","product-edit-input small-number");otherCosts.type="number";otherCosts.min="0";otherCosts.step="1";otherCosts.value=String(p.other_costs_xof??0);otherCosts.setAttribute("aria-label","Autres frais XOF");
  append(costCell,labeledControl("Prix source",srcPrice),labeledControl("Devise",srcCurrency),labeledControl("1 unité = XOF",exchange),labeledControl("Livraison source (XOF)",sourceShip),labeledControl("Autres frais (XOF)",otherCosts));
  const margin=node("input","product-edit-input small-number");margin.type="number";margin.min="0";margin.max="500";margin.step="1";margin.value=String(p.margin_percent??30);margin.setAttribute("aria-label","Marge en pourcentage");
  const sellPrice=node("input","product-edit-input small-number");sellPrice.type="number";sellPrice.readOnly=true;sellPrice.value=String(p.price??0);sellPrice.setAttribute("aria-label","Prix de vente calculé XOF");
  const costHint=node("small","muted-small","");
  const calc=()=>{const sale=calculateSalePrice(srcPrice.value,exchange.value,sourceShip.value,otherCosts.value,margin.value);sellPrice.value=sale===null?"":String(sale);const cost=Number(srcPrice.value)*Number(exchange.value)+Number(sourceShip.value)+Number(otherCosts.value);costHint.textContent=Number.isFinite(cost)&&cost>0?"Coût estimé : "+formatMoney(cost,"XOF")+" · vente : "+(sale===null?"à vérifier":formatMoney(sale,"XOF")):"Renseigne le coût fournisseur";};
  [srcPrice,exchange,sourceShip,otherCosts,margin].forEach(el=>el.addEventListener("input",calc));srcCurrency.addEventListener("change",()=>{if(srcCurrency.value==="XOF")exchange.value="1";calc();});calc();
  append(marginCell,labeledControl("Majoration cible (%)",margin),labeledControl("Prix client (XOF)",sellPrice),costHint);
  const fulfillment=node("select","product-edit-input");
  [["on_demand","À la commande"],["supplier_direct","Livraison directe fournisseur"],["stocked","Stock déjà disponible"]].forEach(([v,label])=>{const o=node("option","",label);o.value=v;o.selected=v===(p.fulfillment_mode||"on_demand");fulfillment.appendChild(o);});
  const stock=node("input","product-edit-input small-number");stock.type="number";stock.min="0";stock.step="1";stock.value=String(p.stock_quantity??0);stock.setAttribute("aria-label","Stock actuel");
  const threshold=node("input","product-edit-input small-number");threshold.type="number";threshold.min="0";threshold.step="1";threshold.value=String(p.low_stock_threshold??5);threshold.setAttribute("aria-label","Seuil de stock faible");
  append(modeCell,labeledControl("Approvisionnement",fulfillment),labeledControl("Stock existant",stock),labeledControl("Seuil d’alerte",threshold));
  const active=node("input","product-edit-check");active.type="checkbox";active.checked=Boolean(p.is_active);
  const fresh=node("input","product-edit-check");fresh.type="checkbox";fresh.checked=false;
  const age=node("small","muted-small",sourceIsFresh(p)?"Référence vérifiée le "+formatDate(p.source_checked_at):"Source absente ou expirée");
  append(stateCell,labeledControl("Actif sur la boutique",active),labeledControl("J’ai revérifié le prix aujourd’hui",fresh),age);
  const save=node("button","btn btn-primary","Enregistrer");save.type="button";
  save.addEventListener("click",async()=>{
   const nameValue=name.value.trim(),srcName=sourceName.value.trim(),srcUrl=sourceUrl.value.trim(),srcValue=Number(srcPrice.value),rate=Number(exchange.value),ship=Number(sourceShip.value),costs=Number(otherCosts.value),marginValue=Number(margin.value),stockValue=Number(stock.value),thresholdValue=Number(threshold.value);
   if(!nameValue||!srcName||!/^https?:\/\//i.test(srcUrl))return toast("Le produit doit avoir un nom, un vendeur source et un lien HTTP(S) valide.",true);
   if(!Number.isFinite(srcValue)||srcValue<=0||!Number.isFinite(rate)||rate<=0||![ship,costs,marginValue,stockValue,thresholdValue].every(Number.isFinite)||ship<0||costs<0||marginValue<0||marginValue>500||!Number.isInteger(stockValue)||stockValue<0||!Number.isInteger(thresholdValue)||thresholdValue<0)return toast("Vérifie le prix source, la conversion, les coûts, la marge et le stock.",true);
   const sourceChanged=srcName!==String(p.source_store_name||"")||srcUrl!==String(p.source_url||"")||srcValue!==Number(p.source_price)||srcCurrency.value!==(p.source_currency||"XOF")||rate!==Number(p.source_exchange_rate||1)||ship!==Number(p.source_shipping_xof||0)||costs!==Number(p.other_costs_xof||0);
   if(sourceChanged&&!fresh.checked)return toast("Coche la vérification après avoir ouvert le lien fournisseur et contrôlé le prix actuel.",true);
   const newPrice=calculateSalePrice(srcValue,rate,ship,costs,marginValue);
   if(newPrice===null)return toast("Impossible de calculer un prix de vente avec ces valeurs.",true);
   if(fulfillment.value==="stocked"&&stockValue<1&&active.checked)return toast("Pour vendre un produit en stock, indique un stock supérieur à zéro ou choisis l’approvisionnement à la commande.",true);
   const patch={name:nameValue,sku:sku.value.trim()||null,category:category.value.trim()||"Catalogue",description:description.value.trim().slice(0,1000),image_url:safeEditorUrl(image.value,"image du produit")||null,price:newPrice,price_label:formatMoney(newPrice,"XOF"),currency:"XOF",stock_quantity:stockValue,low_stock_threshold:thresholdValue,is_active:active.checked,is_demo:false,source_store_name:srcName,source_url:srcUrl,source_price:srcValue,source_currency:srcCurrency.value,source_exchange_rate:rate,source_shipping_xof:ship,other_costs_xof:costs,margin_percent:marginValue,fulfillment_mode:fulfillment.value};
   if(fresh.checked)patch.source_checked_at=new Date().toISOString();
   setBusy(save,true,"Sauvegarde…");
   try{const {error}=await state.supabase.from("products").update(patch).eq("id",p.id).eq("organization_id",state.organization.id);if(error)throw error;toast("Produit et référence de prix mis à jour.");await reloadData();}
   catch(e){toast(friendlyError(e),true);}finally{setBusy(save,false);}
  });
  const remove=node("button","delete-button","Supprimer");remove.type="button";remove.addEventListener("click",async()=>{if(!confirm("Supprimer le produit « "+p.name+" » ? Il restera impossible de le supprimer s’il est associé à une commande."))return;try{const {error}=await state.supabase.from("products").delete().eq("id",p.id).eq("organization_id",state.organization.id);if(error)throw error;toast("Produit supprimé.");await reloadData();}catch(e){toast(friendlyError(e),true);}});
  const historyDetails=node("details","price-history-details"),historySummary=node("summary","","Historique des prix vérifiés"),historyList=node("div","price-history-list");
  historyDetails.append(historySummary,historyList);
  historyDetails.addEventListener("toggle",async()=>{
   if(!historyDetails.open||historyDetails.dataset.loaded==="true")return;
   historyDetails.dataset.loaded="true";historyList.replaceChildren(node("small","muted-small","Chargement de l’historique…"));
   try{
    const {data,error}=await state.supabase.from("product_price_history")
      .select("source_store_name,source_url,source_price,source_currency,source_exchange_rate,source_shipping_xof,other_costs_xof,margin_percent,selling_price_xof,checked_at")
      .eq("product_id",p.id).eq("organization_id",state.organization.id).eq("site_id",p.site_id)
      .order("checked_at",{ascending:false}).limit(10);
    if(error)throw error;
    historyList.replaceChildren();
    if(!data?.length){historyList.appendChild(node("small","muted-small","Aucune vérification archivée pour le moment."));return;}
    data.forEach(entry=>{
     const item=node("div","price-history-item"),title=node("strong","",formatMoney(entry.source_price,entry.source_currency||"XOF")+" · vente "+formatMoney(entry.selling_price_xof,"XOF"));
     const costs=Number(entry.source_price||0)*Number(entry.source_exchange_rate||1)+Number(entry.source_shipping_xof||0)+Number(entry.other_costs_xof||0);
     const detail=node("small","",String(entry.source_store_name||"Vendeur")+" · coût estimé "+formatMoney(costs,"XOF")+" · majoration "+String(entry.margin_percent||0)+" % · vérifié le "+formatDate(entry.checked_at));
     item.append(title,detail);
     if(entry.source_url&&/^https?:\/\//i.test(entry.source_url)){const link=node("a","source-reference-link","Ouvrir la source ↗");link.href=entry.source_url;link.target="_blank";link.rel="noopener noreferrer";item.appendChild(link);}
     historyList.appendChild(item);
    });
   }catch(error){historyDetails.dataset.loaded="false";historyList.replaceChildren(node("small","muted-small",friendlyError(error)));}
  });
  append(actions,historyDetails,save,remove);
  tbody.appendChild(row);
  append(row,productCell,sourceCell,costCell,marginCell,modeCell,stateCell,actions);
 });
 setTableContent(wrapper,table,items.length>0,q?"Aucun produit ne correspond à cette recherche.":"Ajoute un produit avec son lien source pour calculer et vérifier ta marge avant publication.");
}
function orderOptionSelect(values,current,label){
 const select=node("select","product-edit-input");select.setAttribute("aria-label",label);
 values.forEach(([v,text])=>{const opt=node("option","",text);opt.value=v;opt.selected=v===current;select.appendChild(opt);});
 return select;
}
async function saveOrderFulfillment(order,controls,button){
 if(!["owner","admin","staff"].includes(state.role))return toast("Tu n’as pas les droits nécessaires pour modifier cette commande.",true);
 setBusy(button,true,"Enregistrement…");
 const parseOptional=(input)=>String(input.value||"").trim()===""?null:Number(input.value);
 const numberValue=(input)=>String(input.value||"").trim()===""?0:Number(input.value);
 const eta=controls.eta.value?new Date(controls.eta.value+"T12:00:00").toISOString():null;
 const args={p_order_id:order.id,p_payment_status:controls.payment.value,p_payment_method:controls.method.value.trim(),p_procurement_status:controls.procurement.value,p_supplier_order_reference:controls.reference.value.trim(),p_delivery_provider:controls.provider.value.trim(),p_tracking_code:controls.tracking.value.trim(),p_estimated_delivery_at:eta,p_delivery_fee_xof:numberValue(controls.deliveryFee),p_estimated_delivery_cost_xof:numberValue(controls.deliveryCost),p_actual_purchase_cost_xof:parseOptional(controls.purchaseActual),p_actual_delivery_cost_xof:parseOptional(controls.deliveryActual)};
 try{const {error}=await state.supabase.rpc("update_storefront_order_fulfillment",args);if(error)throw error;toast("Suivi d’approvisionnement, paiement et livraison enregistré.");await reloadData();}
 catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}
}
function renderOrders(){
 const statusFilter=$("#orderStatusFilter").value,siteFilter=$("#orderSiteFilter").value;
 const items=state.orders.filter(o=>(!statusFilter||o.status===statusFilter)&&(!siteFilter||o.site_id===siteFilter));
 const wrapper=$("#ordersTableWrap"),table=createTable(["Commande","Client & adresse","Articles et références source","Montant client","Marge sur coûts saisis","État","Approvisionnement & livraison"]),tbody=$("tbody",table);
 items.forEach(o=>{
  const row=node("tr"),orderCell=node("td"),customer=node("td"),itemCell=node("td"),total=node("td"),marginCell=node("td"),statusCell=node("td"),fulfillmentCell=node("td");
  const site=state.sites.find(s=>s.id===o.site_id);
  append(orderCell,node("strong","","#"+o.order_number),node("small","",site?.name||"Boutique"),node("small","",formatDate(o.created_at)));
  append(customer,node("strong","",o.customer_name||"Client"),node("small","",o.customer_phone||""),node("small","",o.customer_address||"Adresse à confirmer"),node("small","",o.notes||""));
  const contactDigits=String(o.customer_phone||"").replace(/\D/g,"");
  const contactPhone=contactDigits.length===9?"221"+contactDigits:contactDigits.startsWith("00")?contactDigits.slice(2):contactDigits;
  if(contactPhone.length>=8){
   const contactMessage="Bonjour "+String(o.customer_name||"")+" ! Nous avons reçu votre commande n°"+o.order_number+" sur "+String(site?.name||"SAMA")+". Le montant des articles est de "+formatMoney(o.total,o.currency||"XOF")+". Nous vérifions la disponibilité chez le fournisseur. Avant l’achat, nous vous confirmerons le prix final, les frais et le délai de livraison. Pouvez-vous confirmer votre adresse et rester joignable ?";
   const contact=node("a","btn btn-outline order-contact-link","Confirmer avec le client ↗");
   contact.href="https://wa.me/"+contactPhone+"?text="+encodeURIComponent(contactMessage);contact.target="_blank";contact.rel="noopener noreferrer";
   customer.appendChild(contact);
  }
  const lines=o.order_items||[];
  lines.forEach(item=>{
    const line=node("div","order-product-line");
    append(line,node("strong","",String(item.quantity||1)+" × "+item.product_name),node("small","",formatMoney(item.unit_price,"XOF")+" chacun"));
    if(item.source_url&&/^https?:\/\//i.test(item.source_url)){const link=node("a","source-reference-link","Acheter chez "+(item.source_store_name||"le fournisseur")+" ↗");link.href=item.source_url;link.target="_blank";link.rel="noopener noreferrer";append(line,link);}
    itemCell.appendChild(line);
  });
  total.appendChild(node("strong","",formatMoney(o.total,o.currency||"XOF")));
  if(Number(o.delivery_fee_xof||0)>0)total.appendChild(node("small","", "Livraison facturée : "+formatMoney(o.delivery_fee_xof,"XOF")));
  const purchaseCost=o.actual_purchase_cost_xof==null?Number(o.estimated_purchase_cost_xof||0):Number(o.actual_purchase_cost_xof);
  const deliveryCost=o.actual_delivery_cost_xof==null?Number(o.estimated_delivery_cost_xof||0):Number(o.actual_delivery_cost_xof);
  const estimatedProfit=Number(o.total||0)+Number(o.delivery_fee_xof||0)-purchaseCost-deliveryCost;
  const actual= o.actual_purchase_cost_xof!=null&&o.actual_delivery_cost_xof!=null;
  append(marginCell,node("strong","",formatMoney(estimatedProfit,"XOF")),node("small","",actual?"Calculé avec les coûts réels saisis":"Prévision · à confirmer après achat et livraison"));
  if(o.status==="cancelled"||o.status==="completed")statusCell.appendChild(statusPill(o.status));
  else{
    const select=orderOptionSelect(({pending:[["pending","À traiter"],["confirmed","Confirmée"],["cancelled","Annulée"]],confirmed:[["confirmed","Confirmée"],["preparing","En préparation"],["cancelled","Annulée"]],preparing:[["preparing","En préparation"],["shipped","Expédiée"],["cancelled","Annulée"]],shipped:[["shipped","Expédiée"],["completed","Terminée"]]}[o.status]||[[o.status,statusName(o.status)]]),o.status,"État de la commande #"+o.order_number);
    select.disabled=!["owner","admin","staff"].includes(state.role);
    select.addEventListener("change",async()=>{const next=select.value;if(next==="cancelled"&&!confirm("Annuler la commande #"+o.order_number+" ? Le stock local sera restitué uniquement pour les produits déjà en stock.")){select.value=o.status;return;}select.disabled=true;try{const {error}=await state.supabase.rpc("update_order_status",{p_order_id:o.id,p_status:next});if(error)throw error;toast("État de la commande mis à jour.");await reloadData();}catch(e){toast(friendlyError(e),true);select.disabled=false;select.value=o.status;}});
    statusCell.appendChild(select);
  }
  const details=node("details","fulfillment-details"),summary=node("summary","","Gérer achat & livraison");details.appendChild(summary);
  const form=node("div","fulfillment-grid");
  const controls={
    procurement:orderOptionSelect([["not_ordered","À acheter"],["ordered","Commandé chez le fournisseur"],["received","Produit reçu"],["unavailable","Indisponible chez le fournisseur"],["returned","Retourné"]],o.procurement_status||"not_ordered","État d’approvisionnement"),
    payment:orderOptionSelect([["pending","Non confirmé"],["awaiting_payment","Paiement attendu"],["paid","Payé"],["cash_on_delivery","Paiement à la livraison"],["refunded","Remboursé"]],o.payment_status||"pending","État du paiement"),
    method:node("input","product-edit-input"),reference:node("input","product-edit-input"),provider:node("input","product-edit-input"),tracking:node("input","product-edit-input"),eta:node("input","product-edit-input"),deliveryFee:node("input","product-edit-input small-number"),deliveryCost:node("input","product-edit-input small-number"),purchaseActual:node("input","product-edit-input small-number"),deliveryActual:node("input","product-edit-input small-number")
  };
  controls.method.value=o.payment_method||"";controls.method.placeholder="Ex. Wave, Orange Money, espèces";controls.reference.value=o.supplier_order_reference||"";controls.reference.placeholder="Référence d’achat fournisseur";controls.provider.value=o.delivery_provider||"";controls.provider.placeholder="Choisir ou saisir un partenaire";controls.provider.setAttribute("list","deliveryPartnerOptions");controls.tracking.value=o.tracking_code||"";controls.tracking.placeholder="N° de suivi / lien";
  controls.eta.type="date";controls.eta.value=o.estimated_delivery_at?new Date(o.estimated_delivery_at).toISOString().slice(0,10):"";
  [[controls.deliveryFee,o.delivery_fee_xof],[controls.deliveryCost,o.estimated_delivery_cost_xof],[controls.purchaseActual,o.actual_purchase_cost_xof],[controls.deliveryActual,o.actual_delivery_cost_xof]].forEach(([el,val])=>{el.type="number";el.min="0";el.step="1";el.value=val==null?"":String(val);});
  append(form,
    labeledControl("Approvisionnement",controls.procurement),
    labeledControl("Paiement",controls.payment),
    labeledControl("Mode de paiement",controls.method),
    labeledControl("Référence fournisseur",controls.reference),
    labeledControl("Coursier / transporteur",controls.provider),
    labeledControl("Suivi / tracking",controls.tracking),
    labeledControl("Livraison estimée",controls.eta),
    labeledControl("Frais livraison facturés au client (XOF)",controls.deliveryFee),
    labeledControl("Coût livraison estimé (XOF)",controls.deliveryCost),
    labeledControl("Coût réel total fournisseur (achat + frais) en XOF",controls.purchaseActual),
    labeledControl("Livraison réellement payée (XOF)",controls.deliveryActual)
  );
  const save=node("button","btn btn-primary","Enregistrer le suivi");save.type="button";save.addEventListener("click",()=>saveOrderFulfillment(o,controls,save));form.appendChild(save);details.appendChild(form);fulfillmentCell.appendChild(details);
  append(row,orderCell,customer,itemCell,total,marginCell,statusCell,fulfillmentCell);tbody.appendChild(row);
 });
 setTableContent(wrapper,table,items.length>0,"Aucune commande pour ces filtres. Les commandes des boutiques publiées apparaîtront ici.");
}
function filterNavigation(query){const q=String(query||"").trim().toLocaleLowerCase("fr");const items=$(".nav-item");let matches=0;items.forEach(item=>{const match=!q||item.textContent.toLocaleLowerCase("fr").includes(q);item.classList.toggle("search-hidden",!match);if(match&&!item.hidden)matches++;});const empty=$("#featureSearchEmpty");if(empty)empty.hidden=!q||matches>0;}
function switchView(view){const map={overview:["VUE D’ENSEMBLE","Bonjour.","Voici les boutiques, les commandes et les livraisons à suivre."],sites:["MES BOUTIQUES","Tes boutiques.","Gère les dix enseignes, leurs catalogues et leur publication."],products:["APPROVISIONNEMENT","Produits & marges.","Référence les prix fournisseurs, calcule ta marge et choisis comment chaque article sera livré."],orders:["COMMANDES & LIVRAISONS","Commandes reçues en ligne.","Confirme la disponibilité, achète chez le fournisseur et suis la remise au client."],settings:["PARAMÈTRES","Ton espace SAMA Commerce.","Retrouve ton compte, tes accès et les informations de la plateforme."],manage:["IDENTITÉ & LIVRAISON","Informations des boutiques.","Modifie les coordonnées, les règles de livraison et les éléments de présentation."],content:["PAGES & MÉDIAS","Contenu des boutiques.","Crée des pages utiles, ajoute les informations de livraison et garde les versions enregistrées."],support:["SAMA COMMERCE","Demandes internes.","Administration centrale des boutiques SAMA."],review:["BOUTIQUES À PUBLIER","Vérification avant publication.","Contrôle les prix sources, les produits et les marges avant de mettre une boutique en ligne."]};state.view=view in map?view:"overview";Object.keys(map).forEach(k=>$("#view-"+k).classList.toggle("hidden",k!==state.view));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));$("#pageEyebrow").textContent=map[state.view][0];$("#pageTitle").textContent=map[state.view][1];$("#pageSubtitle").textContent=map[state.view][2];}
function parseExportedHtml(html){const marker="window.SAMA_STORE_DATA=",i=html.indexOf(marker);if(i<0)return null;const start=i+marker.length,end=html.indexOf(";(",start);if(end<0)return null;try{const d=JSON.parse(html.slice(start,end));return d&&typeof d==="object"&&d.business&&Array.isArray(d.products)?d:null;}catch{return null;}}
async function onCreateSite(event){event.preventDefault();if(!state.organization)return toast("Crée ou sélectionne une entreprise avant de continuer.",true);const button=$('button[type="submit"]',$("#siteForm")),file=$("#siteHtmlFile").files?.[0],name=$("#siteNameInput").value.trim(),slug=escapeSlug($("#siteSlugInput").value);if(!file)return toast("Choisis le fichier HTML exporté.",true);if(file.size>2900000)return toast("Le HTML dépasse la limite de 2,9 Mo.",true);if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))return toast("Le sous-domaine doit contenir 3 à 60 caractères, minuscules, chiffres et tirets.",true);setBusy(button,true,"Importation…");try{const html=await file.text();if(!html.toLowerCase().includes("<!doctype html"))throw new Error("Le fichier n’a pas l’air d’être un document HTML.");const data=parseExportedHtml(html),templateId=data?.template?.id||$("#siteTemplateInput").value||"distribution";const {data:site,error}=await state.supabase.from("sites").insert({organization_id:state.organization.id,name,slug,template_id:templateId,status:"draft",html_content:html,created_by:state.user.id}).select("id,name,slug").single();if(error)throw error;let imported=0;if(data?.products?.length){const rows=data.products.slice(0,100).map(p=>({organization_id:state.organization.id,site_id:site.id,external_ref:String(p.id||"").slice(0,180)||null,name:String(p.name||"Produit importé").trim().slice(0,180),sku:null,category:String(p.category||p.type||"Catalogue").slice(0,100),description:String(p.description||"").slice(0,1000),image_url:/^https?:\/\//i.test(String(p.image||""))?String(p.image).slice(0,500):null,price:parsePrice(p.price),price_label:String(p.price||"Prix à confirmer").slice(0,100),currency:"XOF",stock_quantity:0,low_stock_threshold:5,is_active:true,is_demo:true}));if(rows.length){const {error:productError}=await state.supabase.from("products").insert(rows);if(productError){await state.supabase.from("sites").delete().eq("id",site.id);throw productError;}imported=rows.length;}}$("#siteForm").reset();$("#siteFormHint").textContent="Les produits importés sont à vérifier.";$("#siteTemplateInput").value=templateId;toast("Site enregistré"+(imported?"; "+imported+" produit(s) importé(s) à vérifier.":". Ajoute ensuite ses produits dans l’inventaire."));await reloadData();switchView("sites");}catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}}
function refreshProductPricePreview(){
 const source=Number($("#productSourcePriceInput")?.value),rate=Number($("#productExchangeRateInput")?.value),ship=Number($("#productSourceShippingInput")?.value),other=Number($("#productOtherCostsInput")?.value),margin=Number($("#productMarginInput")?.value);
 const cost=source*rate+ship+other,price=calculateSalePrice(source,rate,ship,other,margin),priceField=$("#productPriceInput"),hint=$("#productPricePreviewText");
 if(priceField)priceField.value=price===null?"":String(price);
 if(hint)hint.textContent=Number.isFinite(cost)&&cost>0&&price!==null?"Coût estimé : "+formatMoney(cost,"XOF")+" · marge cible : "+margin+" % · vente : "+formatMoney(price,"XOF"):"Renseigne un prix source valide pour calculer la vente.";
}
async function createMyBoutiques(){
 if(!state.organization)return toast("Connecte-toi à ton espace SAMA STUDIO avant de préparer les boutiques.",true);
 if(!state.isSamaAdmin||!state.organization||state.organization.owner_id!==state.user?.id||!["owner","admin"].includes(state.role))return toast("La préparation des boutiques est réservée au propriétaire SAMA.",true);
 const templates=Array.isArray(window.SAMA_SITE_TEMPLATES)?window.SAMA_SITE_TEMPLATES:[];
 const renderer=window.SAMA_STOREFRONT_RENDERER;
 if(templates.length<10||typeof renderer?.buildClientHtml!=="function")return toast("Les modèles de boutique ne sont pas prêts. Recharge la page et réessaie.",true);
 const config=[
  ["distribution","SAMA Market","sama-market"],["fashion","SAMA Mode","sama-mode"],["beauty","SAMA Beauté","sama-beaute"],
  ["electronics","SAMA Tech","sama-tech"],["home","SAMA Maison","sama-maison"],["grocery","SAMA Épicerie","sama-epicerie"],
  ["restaurant","SAMA Bébé & Famille","sama-bebe-famille"],["bakery","SAMA Papeterie & Bureau","sama-papeterie-bureau"],["services","SAMA Auto & Moto","sama-auto-moto"],
  ["realestate","SAMA Sport & Loisirs","sama-sport-loisirs"]
 ];
 const button=$("#prepareBoutiquesBtn"),label=$("#prepareBoutiquesStatus");
 setBusy(button,true,"Préparation des boutiques…");if(label)label.textContent="Création des fiches en brouillon…";
 let created=0,existing=0;
 try{
  for(const [templateId,shopName,slug] of config){
   if(state.sites.some(site=>site.slug===slug)){existing++;continue;}
   const template=templates.find(t=>t.id===templateId);
   if(!template)throw new Error("Modèle manquant : "+templateId);
   const data={
    schemaVersion:"1.1.0",product:"Sama Commerce",status:"draft",
    template:{id:template.id,number:template.number,name:template.name,sector:template.sector,layout:template.layout,useCase:template.useCase||"",recommendedPages:template.recommendedPages||[],managementModules:template.managementModules||[],customerJourney:template.customerJourney||"",catalogLabel:template.catalogLabel||"Catalogue",orderMode:"online",eyebrow:template.eyebrow||template.sector,heroImage:template.heroImage,features:template.features||[],navigation:template.nav||[]},
    business:{name:shopName,headline:template.headline||shopName,city:"Dakar, Sénégal",phone:"",whatsapp:"",email:"",address:"",description:template.body||("Découvrez la sélection "+template.sector+" de SAMA."),hours:"Commandes en ligne, 24 h/24. La disponibilité est confirmée avant validation.",delivery:"Livraison à domicile organisée avec un prestataire. Le tarif et le délai sont confirmés avant validation.",instagram:"",facebook:"",logoUrl:"",seoTitle:(shopName+" | Boutique en ligne au Sénégal").slice(0,70),seoDescription:("Découvrez "+template.sector+" chez "+shopName+". Commande en ligne et livraison au Sénégal.").slice(0,170)},
    design:{primaryColor:template.color||"#17633d",secondaryColor:template.soft||"#e9f5ec",darkColor:template.dark||"#153c2c"},
    includedCapabilities:template.features||[],products:[],pages:[],media:[],createdAt:new Date().toISOString(),
    note:"Boutique propre SAMA. Catalogue sans exemples : les produits, prix et liens sources doivent être vérifiés avant publication."
   };
   const html=renderer.buildClientHtml(data);
   const {error}=await state.supabase.from("sites").insert({organization_id:state.organization.id,name:shopName,slug,template_id:templateId,status:"draft",review_status:"draft",review_note:null,submitted_at:null,html_content:html,created_by:state.user.id});
   if(error)throw error;
   created++;
   if(label)label.textContent=created+" boutique(s) préparée(s)…";
  }
  await reloadData();switchView("sites");
  const message=created+" boutique(s) créée(s), "+existing+" déjà présente(s). Ajoute des produits avec leurs prix sources avant de publier.";
  if(label)label.textContent=message;toast(message);
 }catch(e){if(label)label.textContent="La préparation s’est arrêtée. Les boutiques déjà créées sont conservées.";toast(friendlyError(e),true);try{await reloadData();}catch(_){}}
 finally{setBusy(button,false);}
}
async function onCreateProduct(event){
 event.preventDefault();
 const button=$('button[type="submit"]',$("#productForm")),siteId=$("#productSiteSelect").value;
 if(!siteId)return toast("Crée d’abord tes boutiques avec le bouton « Créer les boutiques manquantes ».",true);
 const name=$("#productNameInput").value.trim(),sourceStore=$("#productSourceStoreInput").value.trim(),sourceUrl=$("#productSourceUrlInput").value.trim();
 const sourcePrice=Number($("#productSourcePriceInput").value),rate=Number($("#productExchangeRateInput").value),sourceShipping=Number($("#productSourceShippingInput").value),otherCosts=Number($("#productOtherCostsInput").value),margin=Number($("#productMarginInput").value),price=calculateSalePrice(sourcePrice,rate,sourceShipping,otherCosts,margin),stock=Number($("#productStockInput").value),threshold=Number($("#productThresholdInput").value),mode=$("#productFulfillmentModeInput").value;
 if(!name||!sourceStore||!/^https?:\/\//i.test(sourceUrl))return toast("Ajoute le nom du produit, le vendeur et le lien exact de la fiche en ligne.",true);
 if(!$("#productSourceVerified").checked)return toast("Ouvre la source en ligne et confirme que tu as vérifié le prix aujourd’hui.",true);
 if(price===null||!Number.isInteger(stock)||stock<0||!Number.isInteger(threshold)||threshold<0)return toast("Vérifie le prix fournisseur, la conversion, les frais et la marge.",true);
 if(mode==="stocked"&&stock<1)return toast("Un produit en stock doit avoir une quantité disponible supérieure à zéro.",true);
 setBusy(button,true,"Enregistrement…");
 try{
  const {error}=await state.supabase.from("products").insert({
   organization_id:state.organization.id,site_id:siteId,sku:$("#productSkuInput").value.trim()||null,name,
   category:$("#productCategoryInput").value.trim()||"Catalogue",description:$("#productDescriptionInput").value.trim(),
   image_url:$("#productImageInput").value.trim()?safeEditorUrl($("#productImageInput").value,"image du produit"):null,
   price,price_label:formatMoney(price,"XOF"),currency:"XOF",stock_quantity:stock,low_stock_threshold:threshold,
   is_active:true,is_demo:false,source_store_name:sourceStore,source_url:sourceUrl,source_price:sourcePrice,
   source_currency:$("#productSourceCurrencyInput").value,source_exchange_rate:rate,source_shipping_xof:sourceShipping,
   other_costs_xof:otherCosts,margin_percent:margin,fulfillment_mode:mode,source_checked_at:new Date().toISOString()
  });
  if(error)throw error;
  $("#productForm").reset();$("#productCategoryInput").value="Catalogue";$("#productStockInput").value="0";$("#productThresholdInput").value="5";$("#productMarginInput").value="30";$("#productExchangeRateInput").value="1";$("#productSourceShippingInput").value="0";$("#productOtherCostsInput").value="0";$("#productSourceCurrencyInput").value="XOF";$("#productFulfillmentModeInput").value="on_demand";refreshProductPricePreview();
  toast("Produit enregistré avec un prix source vérifié et une marge calculée.");await reloadData();switchView("products");
 }catch(e){toast(friendlyError(e),true);}finally{setBusy(button,false);}
}
async function onCreateOrganization(event){event.preventDefault();toast("La création d’organisations est désactivée. L’administration reste réservée au compte propriétaire SAMA.",true);}
function bindEvents(){
 const on=(selector,event,handler,root=document)=>{const element=$(selector,root);if(element)element.addEventListener(event,handler);}; on("#authForm","submit",onAuthSubmit);
 on("#toggleAuthModeBtn","click",()=>setAuthMode(state.authMode==="signin"?"signup":"signin")); on("#signOutBtn","click",signOut);
 on("#organizationForm","submit",onCreateOrganization);
 on("#productForm","submit",onCreateProduct);
 on("#prepareBoutiquesBtn","click",createMyBoutiques);
 on("#searchSourceProductBtn","click",()=>{const name=$("#productNameInput")?.value.trim()||"";if(!name){toast("Renseigne d’abord le nom du produit à rechercher.",true);$("#productNameInput")?.focus();return;}const url="https://www.google.com/search?tbm=shop&q="+encodeURIComponent(name+" prix Sénégal achat en ligne");const opened=window.open(url,"_blank","noopener,noreferrer");if(!opened)toast("Autorise l’ouverture du nouvel onglet pour comparer les prix fournisseurs.",true);});
 ["productSourcePriceInput","productExchangeRateInput","productSourceShippingInput","productOtherCostsInput","productMarginInput"].forEach(id=>{const el=$("#"+id);if(el){el.addEventListener("input",refreshProductPricePreview);el.addEventListener("change",refreshProductPricePreview);}});
 on("#productSourceCurrencyInput","change",()=>{if($("#productSourceCurrencyInput").value==="XOF")$("#productExchangeRateInput").value="1";refreshProductPricePreview();});
 on("#siteEditorSiteSelect","change",async()=>{const id=$("#siteEditorSiteSelect")?.value;if(id){try{await loadSiteEditor(id);}catch(e){toast(friendlyError(e),true);}}});
 on("#siteEditorForm","submit",handleSiteEditorSubmit);
 on("#saveAndPublishSiteBtn","click",saveAndPublishEditedSite);
 on("#managementRequestForm","submit",onManagementRequestSubmit);
 on("#organizationSelect","change",async()=>{const next=state.organizations.find(o=>o.id===$("#organizationSelect").value);if(!next)return;state.organization=next;localStorage.setItem("sama_studio_active_org_v1",next.id);await showWorkspace();toast("Entreprise active modifiée.");});
 on("#refreshBtn","click",async()=>{try{await reloadData();if(state.isSamaAdmin)await Promise.all([reloadReviewQueue(),reloadSupportRequests()]);toast("Données actualisées.");}catch(e){toast(friendlyError(e),true);}});
 on("#inventorySiteFilter","change",renderProducts);
 on("#inventorySearch","input",renderProducts);
 on("#orderStatusFilter","change",renderOrders);
 on("#orderSiteFilter","change",renderOrders);
 document.addEventListener("click",ev=>{const nav=ev.target.closest("[data-view]"),link=ev.target.closest("[data-view-link]");if(nav){switchView(nav.dataset.view);const search=$("#featureSearch");if(search){search.value="";filterNavigation("");}}if(link){switchView(link.dataset.viewLink);const search=$("#featureSearch");if(search){search.value="";filterNavigation("");}}});on("#featureSearch","input",event=>filterNavigation(event.target.value));document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();$("#featureSearch")?.focus();}});}
async function init(){$("#currentYear").textContent=String(new Date().getFullYear());bindEvents();setAuthMode("signin");localStorage.removeItem(CONFIG_KEY);try{await configureSupabase(DEFAULT_CONFIG.url,DEFAULT_CONFIG.key);}catch(e){state.supabase=null;showOnly("authPanel");setConnectionStatus(false,"Service indisponible");toast("Le service est momentanément indisponible. Réessaie dans quelques instants.",true);}}
init();