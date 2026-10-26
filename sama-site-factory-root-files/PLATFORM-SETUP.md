# Sama Studio — plateforme multi-entreprise, stocks et publication

Cette version rassemble le tableau de bord, le schéma Supabase, les fonctions Edge et la publication des boutiques avec Cloudflare Pages. Le projet Supabase de production est `jubrkdxrjvkjdlodslcp`. Les migrations et fonctions doivent être déployées avant la première utilisation en production.

## Parcours utilisateur

1. Héberge le dossier du configurateur et `sama-dashboard.html`, `sama-dashboard.css`, `sama-dashboard.js` sur une origine HTTPS. Cloudflare Pages est recommandé pour héberger le tableau de bord.
2. Le tableau de bord est préconfiguré avec l'URL et la clé publique publishable du projet Supabase Sama Studio. La clé publique peut être visible dans le navigateur, mais jamais la clé secrète ou service-role.
3. Crée un compte avec une adresse e-mail et un mot de passe. Si la confirmation e-mail est activée dans Supabase Auth, confirme le message avant la connexion.
4. Crée l'espace de ton entreprise. Les organisations, sites, produits et commandes sont reliés au tenant côté base.
5. Dans « Sites clients », importe un HTML exporté par `site-studio.html`. Le catalogue importé est marqué comme exemple jusqu'à validation manuelle.
6. Dans « Produits & stocks », corrige les informations, fixe un stock et marque chaque produit comme vérifié avant de le rendre publiable.
7. Clique sur « Publier ». La fonction Edge vérifie la session et le rôle puis téléverse le HTML sur Cloudflare Pages. Un projet Pages dédié est créé automatiquement pour chaque site client. L'URL utilise le sous-domaine `pages.dev` de Cloudflare.
8. Suis les commandes dans « Commandes ». Les statuts sont limités aux transitions valides. L'annulation d'une commande non expédiée restitue son stock dans la même transaction.

## Installer le backend Supabase

Le projet à utiliser est `jubrkdxrjvkjdlodslcp`, accessible depuis le [tableau de bord Supabase](https://supabase.com/dashboard/project/jubrkdxrjvkjdlodslcp).

Les migrations versionnées sont dans `supabase/migrations/` :

- `202610260001_sama_studio_multi_tenant.sql` crée les profils, organisations, memberships, sites, produits, commandes, lignes de commande, fonctions RPC, contraintes, index et politiques RLS.
- `202610260002_harden_site_publish_permissions.sql` interdit aux utilisateurs du navigateur de modifier directement le statut ou le contenu de publication.

Applique les migrations avec le CLI Supabase depuis la racine du dépôt :

```sh
supabase login
supabase link --project-ref jubrkdxrjvkjdlodslcp
supabase db push
```

Dans Supabase Auth, définis l'URL du tableau de bord dans les URL du site et les redirections autorisées. Configure le fournisseur e-mail et les paramètres de confirmation comme souhaité.

## Connecter Cloudflare Pages à la publication

### 1. Crée un jeton Cloudflare

Dans Cloudflare, crée un API Token limité à ton compte avec la permission **Account → Cloudflare Pages → Edit** (Pages Write). Ne crée pas de jeton Global API Key pour cet usage. Récupère également l'**Account ID** de ton compte Cloudflare.

### 2. Ajoute les secrets dans Supabase

Ouvre [Supabase → Edge Function Secrets](https://supabase.com/dashboard/project/jubrkdxrjvkjdlodslcp/settings/functions) et ajoute :

- `CLOUDFLARE_API_TOKEN` : le jeton API Cloudflare avec la permission Pages Write.
- `CLOUDFLARE_ACCOUNT_ID` : l'identifiant du compte Cloudflare.

Ces valeurs doivent rester dans les secrets Supabase. Ne les inscris ni dans le code, ni dans GitHub, ni dans la configuration du navigateur.

### 3. Déploie les fonctions Edge

Depuis la racine du dépôt :

```sh
supabase functions deploy publish-site
supabase functions deploy create-storefront-order
```

Les secrets de service Supabase sont fournis côté serveur par Supabase. Si ton environnement utilise des clés publishable/secret récentes, la fonction sait lire les variables standard `SUPABASE_PUBLISHABLE_KEYS` et `SUPABASE_SECRET_KEYS`, ainsi que les variables historiques.

La fonction `publish-site` crée ou réutilise le projet Cloudflare Pages du site client, téléverse le HTML publié, puis enregistre son URL. La fonction `create-storefront-order` est publiquement appelable car les acheteurs n'ont pas besoin d'un compte dans le tableau de bord : elle valide les entrées, limite les tentatives par empreinte IP, puis appelle une fonction SQL privilégiée qui vérifie le tenant, le stock et le tarif dans une transaction.

## Sécurité incluse

- Les tables exposées activent RLS et utilisent les memberships pour isoler les données de chaque entreprise.
- Les politiques vérifient le rôle au niveau de l'organisation.
- Les clés privées sont conservées côté serveur et ne sont pas insérées dans les HTML publiés.
- La publication n'accepte que les propriétaires et administrateurs et exige au moins un produit actif vérifié.
- Les commandes récupèrent les prix et la disponibilité depuis la base plutôt que de faire confiance aux données envoyées par le navigateur.
- Les quantités sont vérifiées et décrémentées transactionnellement ; l'annulation admissible restitue le stock.
- La fonction publique de commande limite le volume des requêtes et ne dévoile pas la clé service-role.

## Limites avant commercialisation

- La publication utilise le domaine par défaut `pages.dev`. Le domaine personnalisé par boutique, la gestion de DNS et les automatisations de certificats ne sont pas intégrés.
- La publication crée un projet Cloudflare Pages par boutique, ce qui doit être surveillé en fonction des limites du compte Cloudflare.
- Le parcours couvre les vitrines avec commandes centralisées, pas le paiement en ligne.
- Le panier reste local au navigateur ; le stock est synchronisé lors de l'enregistrement de la commande.
- L'interface d'invitation d'équipe n'est pas encore incluse. L'attribution d'autres memberships doit être réalisée par un flux serveur sécurisé.
- Facturation SaaS, e-mails transactionnels, suivi de livraison et journal détaillé d'audit ne sont pas inclus.
- Avant d'accueillir de vrais clients, teste la création de compte, l'isolation entre deux comptes, les stocks simultanés, les annulations, les erreurs de publication et le parcours de commande.

## Vérifications

Le workflow `.github/workflows/validate-platform.yml` contrôle la syntaxe des scripts navigateur et la présence des livrables essentiels. Il ne remplace pas un test de bout en bout sur Supabase et Cloudflare.
