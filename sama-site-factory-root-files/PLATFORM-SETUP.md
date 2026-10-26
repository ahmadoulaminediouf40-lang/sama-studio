# Sama Studio — plateforme multi-entreprise, stocks et publication

Cette version ajoute une première couche opérationnelle de gestion SaaS au configurateur. Le dépôt contient désormais le tableau de bord, le schéma Supabase et les fonctions Edge. **Elle n'est pas encore connectée à un projet Supabase de production** : aucun projet Supabase n'était associé à cette session, et le service Netlify doit être configuré dans ton compte avant toute publication réelle.

## Parcours utilisateur

1. Ouvre `sama-dashboard.html` via un hébergement HTTPS ou un serveur local (évite le mode fichier `file://` si les modules sont bloqués).
2. Fournis l'URL Supabase et la clé publique `sb_publishable_…` (ou l'ancienne clé `anon`). La configuration est stockée localement dans ce navigateur.
3. Crée un compte avec une adresse e-mail et un mot de passe. Si la confirmation e-mail est activée dans Supabase Auth, confirme le message avant la connexion.
4. Crée l'espace de ton entreprise. Les organisations, sites, produits et commandes sont reliés au tenant côté base.
5. Dans « Sites clients », importe un HTML exporté par `site-studio.html`. Le catalogue importé est marqué comme exemple jusqu'à validation manuelle.
6. Dans « Produits & stocks », corrige les informations, fixe un stock et coche « Vérifié » pour chaque produit utilisable. Ajoute les nouveaux produits depuis le formulaire.
7. Clique sur « Publier » pour lancer le déploiement statique Netlify via l'Edge Function. Une boutique publiée transmet ses commandes à la même base de données.
8. Suis les commandes dans « Commandes ». Les statuts sont limités aux transitions valides. L'annulation d'une commande non expédiée restitue son stock dans la même transaction.

## Installer le backend

### 1. Crée un projet Supabase
Dans le tableau de bord Supabase, crée un projet pour Sama Studio. Puis applique :

```sh
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Les migrations versionnées se trouvent dans `supabase/migrations/` : `202610260001_sama_studio_multi_tenant.sql` crée les comptes de profil, organisations, memberships, sites, produits, commandes, lignes de commande, fonctions RPC, contraintes, index et politiques RLS ; `202610260002_harden_site_publish_permissions.sql` interdit à un utilisateur du navigateur de modifier le statut ou le contenu de publication directement. `supabase db push` applique les deux migrations dans l’ordre.

Dans Supabase Auth, définis les URL de redirection pour le domaine hébergeant le tableau de bord. Configure le fournisseur e-mail et les paramètres de confirmation comme souhaité.

### 2. Configure les fonctions Edge

Déploie les deux fonctions :

```sh
supabase functions deploy publish-site
supabase functions deploy create-storefront-order
```

Ajoute les secrets côté Supabase (ne les mets pas dans le HTML ou dans Git) :

```sh
supabase secrets set NETLIFY_AUTH_TOKEN=<TOKEN_NETLIFY>
```

Supabase fournit `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` à l'environnement des Edge Functions. Vérifie ces secrets dans ton projet si ton environnement les configure différemment. La clé service-role ne doit jamais être transmise au navigateur.

La fonction `publish-site` vérifie la session et le rôle du membre avant d'utiliser le jeton Netlify côté serveur. Elle construit un déploiement de fichier statique, puis enregistre l'URL publiée dans le site. La fonction `create-storefront-order` est publiquement appelable car les acheteurs ne possèdent pas de compte dans le tableau de bord : elle valide les entrées, limite les tentatives par empreinte IP, puis appelle une fonction SQL privilégiée qui vérifie le tenant, le stock et le tarif dans une transaction.

### 3. Configurer Netlify
Crée un jeton d'accès personnel dans Netlify et conserve-le exclusivement comme secret `NETLIFY_AUTH_TOKEN` Supabase. Le nom du site Netlify est dérivé du slug du site client ; assure-toi que ce nom n'est pas déjà utilisé dans ton compte Netlify. L'hébergement peut imposer ses propres conditions ou limites.

### 4. Héberger le tableau de bord
Publie le dossier du configurateur et `sama-dashboard.html`, `sama-dashboard.css`, `sama-dashboard.js` sur une origine HTTPS autorisée dans les paramètres Auth Supabase. L'accès aux données reste protégé par les politiques RLS, même si la clé publique est visible.

## Mesures de sécurité incluses

- Les tables exposées activent RLS et utilisent `auth.uid()` via les memberships, pas les métadonnées modifiables de l'utilisateur.
- Les politiques vérifient le rôle au niveau de l'organisation.
- Les clés privées n'apparaissent pas dans le navigateur.
- Le HTML importé est isolé par organisation. Les produits importés sont marqués `is_demo=true` jusqu'à vérification.
- La publication n'accepte que les propriétaires et administrateurs et exige au moins un produit actif vérifié.
- Les commandes récupèrent prix et disponibilité depuis la base plutôt que de faire confiance aux prix du navigateur.
- Les quantités sont verrouillées/vérifiées côté SQL, décrémentées transactionnellement et restaurées si une commande admissible est annulée.
- Une fonction publique de commande limite le volume des requêtes et ne dévoile pas la clé service-role.

## Limites et décisions restantes avant la mise en production

- Le backend et l'hébergeur ne sont pas provisionnés par ce commit. Le compte Supabase et le secret Netlify doivent être configurés, puis le schéma doit être appliqué et les fonctions déployées.
- Ce flux est prévu pour des sites vitrines statiques avec commandes WhatsApp/centralisées, pas un paiement en ligne.
- Le panier est local au navigateur. Le stock devient central lors de la commande enregistrée.
- Les membres/roles sont structurés en base; l'interface d'invitation d'équipe n'est pas encore incluse. Un administrateur doit créer/attribuer ces memberships via un flux serveur sécurisé avant que d'autres utilisateurs ne rejoignent son organisation.
- Pas de domaine personnalisé, gestion de DNS/SSL spécifique, facturation SaaS, email transactionnel, suivi de livraison ou journal détaillé d'audit.
- Tester le flux de création de compte, l'isolation entre deux comptes, la gestion des stocks simultanés, les annulations, les erreurs de publication et les limites Netlify sur un environnement de préproduction avant d'y accueillir des clients réels.

## Vérifications

Le workflow `.github/workflows/validate-platform.yml` contrôle la syntaxe des scripts navigateur et la présence des livrables clés. Cette vérification statique ne remplace pas les tests de bout en bout dans un projet Supabase et un compte Netlify configurés.
