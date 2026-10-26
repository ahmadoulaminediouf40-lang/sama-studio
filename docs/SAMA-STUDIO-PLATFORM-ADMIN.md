# SAMA Studio — accès gestionnaire de la plateforme

Le tableau de bord « Demandes SAMA Studio » est réservé aux comptes explicitement inscrits dans `public.site_management_admins`. Les utilisateurs ne peuvent pas s'y inscrire eux-mêmes : la table n'expose aucune permission d'insertion ou de modification côté navigateur.

## Autoriser un gestionnaire

Dans le SQL Editor de Supabase, récupère d'abord l'identifiant UUID du compte SAMA Studio dans **Authentication → Users**, puis exécute :

```sql
insert into public.site_management_admins (user_id)
values ('REMPLACER-PAR-UUID-DU-COMPTE-AUTORISE')
on conflict (user_id) do nothing;
```

N'inscris que des comptes opérateurs de confiance. N'inscris jamais les propriétaires des boutiques comme gestionnaires de la plateforme.

## Cycle d'une demande

1. Le propriétaire ouvre « Gérer mon site » et envoie une demande.
2. SAMA Studio retrouve la demande dans « Demandes SAMA Studio ».
3. Avant acceptation, les autorisations permettent de consulter les informations nécessaires à l'examen de la demande, sans donner accès à l'inventaire et aux commandes.
4. Après acceptation explicite, le compte opérateur obtient le rôle administrateur sur l'espace de l'entreprise.
5. Quand SAMA Studio termine la prise en charge, ou quand le propriétaire retire l'accès, l'accès ajouté par cette demande est révoqué. Un rôle qui existait avant la prise en charge est restauré.

Les prises en charge sont limitées à une demande active par organisation pour éviter des révocations contradictoires. Les mots de passe des clients ne sont jamais nécessaires.
