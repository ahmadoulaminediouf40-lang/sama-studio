# Sama Studio — premier prototype du système multi-templates

## Ce qui est inclus

- `site-studio.html` : interface de sélection des modèles et personnalisation de la fiche client.
- `site-studio.css` : interface du configurateur et styles propres à chaque maquette.
- `site-templates.js` : registre central unique des dix activités et leurs contenus de démonstration.
- `site-studio.js` : rendu des maquettes, bascule bureau/mobile, aperçu interactif, sauvegarde locale et export JSON.

## Les dix modèles

1. Commerce et distribution
2. Mode et accessoires
3. Beauté et cosmétiques
4. Électronique et accessoires
5. Maison et ameublement
6. Épicerie et produits locaux
7. Restaurant et fast-food
8. Boulangerie et traiteur
9. Entreprises de services
10. Immobilier

Les modèles partagent une interface et un registre communs, mais disposent de mises en page, de couleurs et de sections différentes. Les produits et textes visibles sont fictifs, pour la démonstration.

## Tester

Ouvrir `site-studio.html` dans un navigateur. Les quatre fichiers doivent rester dans le même dossier. Les photographies des maquettes sont chargées depuis Unsplash, donc leur affichage nécessite une connexion Internet.

## Ajouter au dépôt SAMA-PACK

1. Travailler sur une branche Git distincte, jamais directement sur la branche de production.
2. Copier les quatre fichiers à la racine du projet (au même niveau que `index.html`, `app.js` et `styles.css`).
3. Prévisualiser `site-studio.html` dans un environnement de test.
4. Ne pas annoncer cette page comme un service client prêt pour la production et ne pas la publier sans contrôle d'accès si elle est destinée à un usage interne.

Le site existant n'a pas été modifié par ces fichiers. Le configurateur est isolé et n'appelle pas Supabase.

## Limites explicites de cette version

- Le bouton d'enregistrement sauvegarde une fiche dans `localStorage` sur le navigateur courant uniquement.
- L'export JSON produit une configuration de projet, pas un site client publiable.
- Les boutons visibles dans les aperçus sont simulés : paiement, panier, notifications, commandes, gestion de stock, espace admin, etc. ne sont pas connectés dans ces maquettes.
- Aucune isolation multi-entreprise (tenant), authentification du studio, création de sous-domaine ou publication automatique n'est implémentée ici.
- Les données de configuration ne sont pas envoyées à un serveur.

## Prochaine étape technique recommandée

Construire le moteur commun de production dans une branche dédiée : modèle de données multi-entreprise, attribution de chaque utilisateur à une entreprise, politiques RLS Supabase fondées sur l'identité et le tenant, configuration de marque persistée, fonctionnalités activées par type d'activité, puis publication isolée par domaine. Cette étape doit être vérifiée avant d'accueillir de vrais clients.
