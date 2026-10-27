import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
function reply(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:cors});}
function clean(value:unknown,limit:number){return String(value??"").trim().slice(0,limit);}
async function fingerprint(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value||"unknown"));return Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed"});
 const url=Deno.env.get("SUPABASE_URL");
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")||(()=>{try{const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");return typeof keys.default==="string"?keys.default:"";}catch{return "";}})();
 if(!url||!service)return reply(500,{error:"Order API is not configured."});
 if(Number(req.headers.get("content-length")||"0")>35000)return reply(413,{error:"Commande trop volumineuse."});
 let body:Record<string,unknown>;try{body=await req.json();}catch{return reply(400,{error:"Corps JSON invalide."});}
 if(clean(body.website,300))return reply(200,{accepted:true});
 const slug=clean(body.site_slug,60),name=clean(body.customer_name,140),phone=clean(body.customer_phone,40),address=clean(body.customer_address,500),notes=clean(body.notes,1000),items=body.items;
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))return reply(400,{error:"Identifiant de boutique invalide."});
 if(name.length<1||phone.replace(/\D/g,"").length<8)return reply(400,{error:"Renseignez votre nom et un numéro de téléphone valide."});
 if(!Array.isArray(items)||items.length<1||items.length>30)return reply(400,{error:"Le panier est vide ou contient trop d’articles."});
 const sanitized:Record<string,unknown>[]=[];
 for(const item of items){if(!item||typeof item!=="object")return reply(400,{error:"Article invalide."});const x=item as Record<string,unknown>,id=clean(x.product_id,40),quantity=Number(x.quantity);if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(quantity)||quantity<1||quantity>99)return reply(400,{error:"Un article ou une quantité est invalide."});const expected=Number(x.expected_unit_price);if(!Number.isFinite(expected)||expected<0)return reply(400,{error:"Prix de l’article invalide. Actualise la boutique."});sanitized.push({product_id:id,quantity,expected_unit_price:expected});}
 const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||"unknown",ipHash=await fingerprint(ip);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.rpc("create_storefront_order",{p_site_slug:slug,p_customer_name:name,p_customer_phone:phone,p_customer_address:address,p_notes:notes,p_items:sanitized,p_ip_hash:ipHash});
 if(error){const message=String(error.message||"Commande impossible.");const status=/Too many order attempts/i.test(message)?429:/not published|unavailable|Insufficient stock/i.test(message)?409:400;return reply(status,{error:message});}
 return reply(201,{accepted:true,order:data});
});