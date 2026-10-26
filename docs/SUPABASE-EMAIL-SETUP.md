# Configuration e-mail de SAMA Studio

Deux circuits e-mail doivent être configurés séparément.

## 1. E-mails d'authentification Supabase

Ce circuit envoie les confirmations d'inscription, les changements d'adresse et les réinitialisations de mot de passe. Supabase Auth a besoin d'un fournisseur SMTP personnalisé pour envoyer des e-mails aux clients réels ; le serveur SMTP de test Supabase n'est pas une solution de production.

1. Choisir un fournisseur SMTP (Resend SMTP, Brevo, Postmark, Amazon SES ou SendGrid).
2. Vérifier le domaine d'envoi auprès du fournisseur et publier les entrées DNS SPF/DKIM recommandées. Ajouter DMARC pour la politique du domaine.
3. Dans le tableau de bord Supabase du projet `jubrkdxrjvkjdlodslcp`, ouvrir Authentication → SMTP Settings (l'emplacement du menu peut évoluer) et activer le SMTP personnalisé.
4. Renseigner le serveur SMTP, le port recommandé par le fournisseur (habituellement 587 avec STARTTLS), l'utilisateur SMTP, le mot de passe SMTP, l'adresse d'expédition vérifiée et le nom d'expéditeur `SAMA Studio`.
5. Dans Authentication → URL Configuration, définir l'URL du site sur `https://sama-studio-web.pages.dev` et autoriser les redirections du tableau de bord et du créateur de sites.
6. Garder la confirmation e-mail activée et tester inscription, confirmation, réinitialisation de mot de passe et changement d'adresse.

Ne pas coller les identifiants SMTP dans le dépôt Git, les fichiers JavaScript du navigateur ou une capture publique.

## 2. Notification e-mail d'un nouveau site à valider

La fonction Supabase Edge `notify-site-review` est déployée. Elle vérifie la session de la personne qui soumet le site avant d'envoyer une notification à SAMA Studio via l'API Resend. Les notifications internes Supabase sont créées même si l'e-mail n'est pas encore configuré.

Dans Supabase → Edge Functions → Secrets, ajouter :

- `RESEND_API_KEY`: clé API privée Resend.
- `SAMA_STUDIO_ADMIN_EMAIL`: adresse (ou liste d'adresses séparées par des virgules) qui doit recevoir la demande de validation.
- `SAMA_STUDIO_FROM_EMAIL`: adresse d'expédition vérifiée chez Resend, par exemple `no-reply@votre-domaine.sn`.
- `SAMA_STUDIO_SENDER_NAME`: facultatif, par exemple `SAMA Studio`.

Une fois les secrets en place, soumettre un site de test : le tableau de bord doit montrer la demande et l'e-mail doit arriver. En l'absence d'un de ces secrets, l'interface confirme que la demande a été enregistrée mais indique que l'e-mail automatique reste à configurer.

## 3. Pourquoi les identifiants sont indispensables

Le dépôt et les migrations ne peuvent pas créer automatiquement un compte fournisseur e-mail, vérifier un domaine ou inventer un mot de passe SMTP/API. Il faut obtenir les paramètres SMTP réels et une adresse d'expédition dont le domaine est vérifié. Ne désactive pas les confirmations d'e-mail pour contourner cette étape.
