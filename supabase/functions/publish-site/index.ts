import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
function reply(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:cors});}
function safeJson(value:unknown){return JSON.stringify(value).replace(/</g,"\\u003c");}
async function netlify(path:string,token:string,init:RequestInit={}){const r=await fetch("https://api.netlify.com/api/v1"+path,{...init,headers:{Authorization:"Bearer "+token,...(init.body?{"Content-Type":"application/json"}:{}),...(init.headers||{})}});const t=await r.text();let d:Record<string,any>={};try{d=t?JSON.parse(t):{};}catch{d={message:t.slice(0,300)};}if(!r.ok)throw new Error("Netlify: "+String(d.message||d.error||"API request failed").slice(0,240));return d;}
function readStoreData(html:string){const marker="window.SAMA_STORE_DATA=",i=html.indexOf(marker);if(i<0)throw new Error("Ce fichier n'est pas un export HTML de Sama Studio (données du catalogue absentes).");const start=i+marker.length,end=html.indexOf(";(",start);if(end<0)throw new Error("Configuration du site illisible. Regénérez le fichier HTML depuis Sama Studio.");let data:Record<string,any>;try{data=JSON.parse(html.slice(start,end));}catch{throw new Error("Configuration du site corrompue.");}return{data,start,end,marker};}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed"});
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),token=Deno.env.get("NETLIFY_AUTH_TOKEN");
 if(!url||!anon||!service)return reply(500,{error:"Supabase function secrets are not configured."});
 if(!token)return reply(503,{error:"Publication automatique indisponible : ajoute le secret NETLIFY_AUTH_TOKEN dans Supabase Edge Functions."});
 const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return reply(401,{error:"Connexion requise."});
 const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authData,error:authError}=await userDb.auth.getUser();if(authError||!authData.user)return reply(401,{error:"Session invalide. Reconnectez-vous."});
 let body:Record<string,unknown>;try{body=await req.json();}catch{return reply(400,{error:"Corps JSON invalide."});}
 const siteId=String(body.site_id||"");if(!/^[0-9a-f-]{36}$/i.test(siteId))return reply(400,{error:"Identifiant de site invalide."});
 const {data:site,error:siteError}=await userDb.from("sites").select("id,organization_id,name,slug,status,html_content,netlify_site_id").eq("id",siteId).single();
 if(siteError||!site)return reply(404,{error:"Site introuvable ou accès refusé."});
 const {data:membership}=await userDb.from("organization_memberships").select("role").eq("organization_id",site.organization_id).eq("user_id",authData.user.id).maybeSingle();
 if(!membership||!["owner","admin"].includes(membership.role))return reply(403,{error:"Seuls le propriétaire ou l’administrateur peuvent publier un site."});
 let html=String(site.html_content||"");if(!html.toLowerCase().includes("<!doctype html")||html.length>2_900_000)return reply(422,{error:"HTML absent ou trop volumineux (limite 2,9 Mo). Réimporte un export HTML valide."});
 let parsed:ReturnType<typeof readStoreData>;try{parsed=readStoreData(html);}catch(e){return reply(422,{error:e instanceof Error?e.message:"Configuration du site invalide."});}
 const {data:rows,error:productsError}=await userDb.from("products").select("id,external_ref,sku,name,category,description,image_url,price,price_label,currency,stock_quantity,is_active,is_demo").eq("site_id",site.id).eq("is_active",true).eq("is_demo",false).order("created_at",{ascending:true});
 if(productsError)return reply(500,{error:"Impossible de lire l’inventaire du site."});
 if(!rows?.length)return reply(422,{error:"Ajoute au moins un produit actif et vérifié dans l’inventaire avant publication."});
 const data=parsed.data as Record<string,any>;
 if(!data.business||typeof data.business!=="object")return reply(422,{error:"Informations de l’entreprise absentes du fichier."});
 data.products=rows.map((p:Record<string,any>)=>({id:p.id,external_ref:p.external_ref,name:p.name,category:p.category||"Catalogue",price:p.price_label||(new Intl.NumberFormat("fr-FR").format(Number(p.price||0))+" "+(p.currency||"XOF")),price_value:Number(p.price||0),currency:p.currency||"XOF",description:p.description||"",image:p.image_url||"",stock_quantity:Number(p.stock_quantity||0)}));
 const dataStart=html.indexOf(parsed.marker)+parsed.marker.length,dataEnd=html.indexOf(";(",dataStart);
 html=html.slice(0,dataStart)+safeJson(data)+html.slice(dataEnd);
 const config={apiUrl:url,publishableKey:anon,siteSlug:site.slug},configScript="window.SAMA_STOREFRONT_CONFIG="+safeJson(config)+";";
 const markerIndex=html.indexOf("window.SAMA_STORE_DATA=");html=html.slice(0,markerIndex)+configScript+html.slice(markerIndex);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 let netlifySiteId=String(site.netlify_site_id||""),netlifySite:Record<string,any>;
 try{
  if(netlifySiteId){netlifySite=await netlify("/sites/"+encodeURIComponent(netlifySiteId),token);}
  else{netlifySite=await netlify("/sites",token,{method:"POST",body:JSON.stringify({name:site.slug})});netlifySiteId=String(netlifySite.id||"");if(!netlifySiteId)throw new Error("Netlify n’a pas retourné l’identifiant du site.");const {error}=await admin.from("sites").update({netlify_site_id:netlifySiteId}).eq("id",site.id);if(error)throw new Error("Site Netlify créé, mais son identifiant ne peut pas être enregistré : "+error.message);}
  const bytes=new TextEncoder().encode(html),digest=await crypto.subtle.digest("SHA-1",bytes),hash=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
  const deployment=await netlify("/sites/"+encodeURIComponent(netlifySiteId)+"/deploys",token,{method:"POST",body:JSON.stringify({files:{"/index.html":hash}})});
  const deployId=String(deployment.id||"");if(!deployId)throw new Error("Netlify n’a pas retourné l’identifiant du déploiement.");
  const required=Array.isArray(deployment.required)?deployment.required as string[]:[];
  if(required.includes(hash)){const uploaded=await fetch("https://api.netlify.com/api/v1/deploys/"+encodeURIComponent(deployId)+"/files/index.html?size="+bytes.length,{method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/octet-stream"},body:bytes});if(!uploaded.ok)throw new Error("Netlify n’a pas accepté le fichier HTML (HTTP "+uploaded.status+").");}
  let finalDeploy=deployment;for(let i=0;i<8;i++){finalDeploy=await netlify("/deploys/"+encodeURIComponent(deployId),token);if(finalDeploy.state==="ready"||finalDeploy.state==="error")break;await new Promise(resolve=>setTimeout(resolve,900));}
  if(finalDeploy.state==="error")throw new Error("Netlify a échoué pendant le déploiement. Vérifie la configuration du site dans Netlify.");
  if(finalDeploy.state!=="ready")return reply(202,{status:"deploying",message:"Netlify traite encore le déploiement. Réessaie dans quelques instants.",deploy_id:deployId});
  const publishedUrl=String(finalDeploy.ssl_url||finalDeploy.url||netlifySite.ssl_url||netlifySite.url||"");
  const {error:updateError}=await admin.from("sites").update({html_content:html,netlify_site_id:netlifySiteId,published_url:publishedUrl,status:"published",published_at:new Date().toISOString()}).eq("id",site.id);
  if(updateError)throw new Error("Le site est en ligne, mais le statut n’a pas pu être enregistré. Réessaie la publication.");
  return reply(200,{status:"published",url:publishedUrl,site_id:site.id,deploy_id:deployId});
 }catch(e){console.error("publish-site failed",e);return reply(502,{error:e instanceof Error?e.message:"Publication échouée. Vérifie le secret Netlify et réessaie."});}
});