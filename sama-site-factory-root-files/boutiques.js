(function(){
"use strict";
const URL="https://jubrkdxrjvkjdlodslcp.supabase.co";
const KEY="sb_publishable_HqIc0fSxhQ9iDThqFXl55g_SJTEiM5h";
const templates={
 distribution:{name:"SAMA Market",sector:"Commerce & distribution",description:"Produits du quotidien, accessoires et articles utiles.",icon:"▦",color:"#e5f1da",ink:"#2b6a3c"},
 fashion:{name:"SAMA Mode",sector:"Mode & accessoires",description:"Vêtements, accessoires et sélections pour tous les styles.",icon:"✦",color:"#f3e5dd",ink:"#8c4d38"},
 beauty:{name:"SAMA Beauté",sector:"Beauté & cosmétiques",description:"Soins, parfums, routines et coffrets beauté.",icon:"✿",color:"#f6e6eb",ink:"#9b4860"},
 electronics:{name:"SAMA Tech",sector:"Électronique & accessoires",description:"Téléphonie, informatique, audio et équipements.",icon:"⌘",color:"#e4eaf8",ink:"#365ea5"},
 home:{name:"SAMA Maison",sector:"Maison & ameublement",description:"Mobilier, rangement, décoration et équipements maison.",icon:"⌂",color:"#f1e9dc",ink:"#89693c"},
 grocery:{name:"SAMA Épicerie",sector:"Épicerie & produits locaux",description:"Produits alimentaires et essentiels du quotidien.",icon:"✺",color:"#e5f0de",ink:"#4c7835"},
 restaurant:{name:"SAMA Food",sector:"Restauration & repas",description:"Repas, menus et offres de restauration selon disponibilité.",icon:"♨",color:"#f7e4d9",ink:"#ab5737"},
 bakery:{name:"SAMA Délices",sector:"Boulangerie & traiteur",description:"Pains, pâtisseries, plateaux et commandes traiteur.",icon:"❋",color:"#f4ead6",ink:"#93692a"},
 services:{name:"SAMA Auto & Moto",sector:"Auto & moto",description:"Pièces auto, accessoires moto et équipements de mobilité sourcés en ligne.",icon:"⌘",color:"#e2eaf8",ink:"#365ea5"},
 realestate:{name:"SAMA Sport & Loisirs",sector:"Sport & loisirs",description:"Équipements de fitness, sport, randonnée et loisirs référencés auprès de vendeurs en ligne.",icon:"✦",color:"#e5f1da",ink:"#2b6a3c"}
};
const grid=document.getElementById("storeGrid");
document.getElementById("year").textContent=String(new Date().getFullYear());
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;}
function render(stores){
 grid.replaceChildren();
 if(!Array.isArray(stores)||!stores.length){
   const empty=el("div","state-panel");
   const icon=el("span","state-icon","✦"),copy=el("div");
   copy.appendChild(el("strong","","Nos boutiques sont en préparation."));
   copy.appendChild(el("p","","Les univers SAMA sont en cours de mise en place. Une boutique sera affichée dès que ses produits, prix sources et conditions de commande auront été vérifiés."));
   empty.append(icon,copy);grid.appendChild(empty);return;
 }
 stores.forEach(store=>{
  const info=templates[store.template_id]||{name:store.store_name||"Boutique SAMA",sector:"Boutique SAMA",description:"Découvrez les produits disponibles.",icon:"▦",color:"#e5f1da",ink:"#2b6a3c"};
  const card=el("a","store-card");card.href=store.storefront_url;card.target="_blank";card.rel="noopener noreferrer";
  const top=el("div","store-card-top"),icon=el("span","store-icon",info.icon);icon.style.setProperty("--tile",info.color);icon.style.setProperty("--icon",info.ink);
  top.append(icon,el("span","live","EN LIGNE"));
  card.appendChild(top);card.appendChild(el("h3","",store.store_name||info.name));card.appendChild(el("p","",info.description));
  const action=el("span","store-action");action.append(el("span","","Explorer les produits"),el("span","","↗"));card.appendChild(action);grid.appendChild(card);
 });
}
async function load(){
 try{
  const response=await fetch(URL+"/rest/v1/rpc/list_published_storefronts",{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:"{}"});
  if(!response.ok)throw new Error("Impossible de charger le catalogue public.");
  render(await response.json());
 }catch(error){
  grid.replaceChildren();
  const box=el("div","state-panel"),icon=el("span","state-icon","↻"),copy=el("div");
  copy.appendChild(el("strong","","Les boutiques ne sont pas disponibles pour le moment."));
  copy.appendChild(el("p","","Réessaie dans quelques instants. L’accès au catalogue public sera rétabli automatiquement."));
  box.append(icon,copy);grid.appendChild(box);
 }
}
load();
})();