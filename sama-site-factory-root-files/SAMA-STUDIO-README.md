# Sama Studio — configurateur et générateur de sites clients

Sama Studio permet de sélectionner un modèle parmi dix secteurs, personnaliser la marque et le catalogue, prévisualiser le rendu sur ordinateur et mobile, puis exporter un site client autonome en HTML.

## Fichiers
- `site-studio.html` : interface du studio.
- `site-studio.css` : styles du configurateur et des dix aperçus.
- `site-release.css` : styles du panneau d'édition et d'export.
- `site-templates.js` : registre central des dix modèles et contenus de démonstration.
- `site-studio.js` : configurateur et aperçu.
- `site-publisher.js` : éditeur du catalogue, sauvegarde locale, export HTML autonome et JSON.
- `validate-release.mjs` : contrôle statique des fichiers et capacités principales.
- `.github/workflows/validate-studio.yml` : validation de syntaxe automatisée.

## Les dix univers
Commerce et distribution, mode et accessoires, beauté et cosmétiques, électronique, maison et ameublement, épicerie et produits locaux, restaurant et fast-food, boulangerie et traiteur, entreprises de services, immobilier.

## Tester et générer un site
1. Garder les fichiers dans le même dossier.
2. Ouvrir `site-studio.html` dans un navigateur récent.
3. Sélectionner un modèle et saisir l'identité, les coordonnées, les couleurs et les informations de livraison.
4. Dans le panneau « Site client prêt à livrer », modifier les produits d'exemple, ajouter ou supprimer des produits.
5. Utiliser « Prévisualiser le site client » puis « Télécharger le site client (.html) ».
6. Ouvrir le HTML téléchargé dans un navigateur pour tester le panier et le parcours de commande.

Une connexion Internet est nécessaire pour les images distantes par défaut. Les URLs d'images d'un client doivent être publiques, stables et utilisées avec les droits appropriés.

## Fonctionnalités du site exporté
- Site responsive sur ordinateur et téléphone.
- Identité, couleurs, description, logo distant, coordonnées, horaires, livraison et réseaux sociaux configurables.
- Catalogue, recherche et filtre par catégorie.
- Panier avec ajout, retrait et gestion des quantités.
- Panier mémorisé localement dans le navigateur du visiteur.
- Préparation de la commande dans WhatsApp avec les produits et quantités.
- Liens téléphone et e-mail, métadonnées de base et partage social.
- HTML autonome, sans framework JavaScript tiers requis à l'exécution.

## Limites à annoncer honnêtement au client
- Les produits et textes initiaux sont fictifs ; vérifier les prix, stocks, informations et droits d'usage des images avant publication.
- Le panier ne réserve pas de stock et ne synchronise pas les données entre appareils.
- La commande est transmise par WhatsApp. Il n'y a pas de paiement en ligne, compte client, facturation, tableau de bord ou suivi serveur de commande.
- Le catalogue livré est figé dans le HTML : le modifier nécessite de regénérer ou éditer le fichier.
- Le domaine, l'hébergement, l'e-mail professionnel, l'analytics et la publication automatique ne sont pas provisionnés.
- Les brouillons du studio restent dans le navigateur courant.

## Déploiement statique
Le HTML généré peut être publié sur un hébergeur statique ou intégré à un hébergement client. Avant publication, tester mobile, navigation, images, numéro WhatsApp, coordonnées et prix.

## Validation
Dans ce dossier, exécuter `node --check site-studio.js`, `node --check site-templates.js`, `node --check site-publisher.js`, `node --check validate-release.mjs` et `node validate-release.mjs`. Le workflow GitHub applique ces vérifications.

## Avant une offre SaaS multi-clients
Il faudra encore un backend configuré (authentification, organisations/tenant, RLS, rôles), gestion média, sauvegardes et publication isolée. Ne jamais exposer une clé `service_role` dans le navigateur. Cette infrastructure n'est pas incluse dans le générateur HTML autonome.
