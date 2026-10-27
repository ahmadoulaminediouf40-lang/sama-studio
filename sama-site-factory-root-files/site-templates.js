/* Registre central des dix modèles. Les contenus sont des exemples de démonstration. */
(function () {
  "use strict";

  const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1100&q=82`;

  window.SAMA_SITE_TEMPLATES = [
    {
      id: "distribution", number: "01", name: "Commerce & distribution", sector: "Commerce", glyph: "CD", layout: "catalog",
      useCase: "Boutiques, grossistes et distributeurs qui vendent des produits physiques.",
      recommendedPages: ["Catalogue","Promotions","Livraison et retours","Contact"],
      managementModules: ["Produits","Catégories","Stock","Commandes","Livraison","Pages et médias"],
      customerJourney: "Découvrir les produits → ajouter au panier → commander via WhatsApp",
      catalogLabel: "Catalogue produits",
      orderMode: "online",
      description: "Catalogue, panier, offres et commandes.", demoBrand: "BOUTIQUE TERANGA", location: "Dakar, Sénégal",
      eyebrow: "SIMPLE. PRATIQUE. CHEZ VOUS.", headline: "Les essentiels du quotidien, au bon endroit.", tagline: "Des produits utiles, des commandes simples.",
      body: "Retrouvez une sélection de produits pour la maison et les professionnels, avec un parcours de commande clair.", cta: "Explorer le catalogue", secondaryCta: "Nos services", nav: ["Catalogue", "Promotions", "Professionnels", "Contact"],
      color: "#17633d", soft: "#e9f5ec", dark: "#153c2c", heroImage: img("photo-1585421514738-01798e348b17"),
      features: ["Catalogue organisé", "Commandes en ligne", "Livraison configurable"],
      cards: [
        { title: "Équipement maison", type: "Sélection populaire", price: "14 500 F", image: img("photo-1581578731548-c64695cc6952") },
        { title: "Accessoires pratiques", type: "Essentiels du quotidien", price: "18 500 F", image: img("photo-1604917877934-07d8d248d396") },
        { title: "Rangement cuisine", type: "Maison & quotidien", price: "8 500 F", image: img("photo-1556911220-bff31c812dba") }
      ]
    },
    {
      id: "fashion", number: "02", name: "Mode & accessoires", sector: "Mode", glyph: "MA", layout: "editorial",
      useCase: "Marques de vêtements, créateurs et boutiques d’accessoires avec collections et variantes.",
      recommendedPages: ["Collections","Guide des tailles","À propos","Livraison et retours"],
      managementModules: ["Collections","Produits","Tailles et couleurs","Stock","Commandes","Pages et médias"],
      customerJourney: "Explorer une collection → choisir les variantes → commander via WhatsApp",
      catalogLabel: "Collections",
      orderMode: "whatsapp",
      description: "Collections, tailles, couleurs et lookbook.", demoBrand: "ATELIER DAKAR", location: "Dakar, Sénégal",
      eyebrow: "COLLECTION NOUVELLE SAISON", headline: "Le style qui vous ressemble.", tagline: "Des pièces choisies avec caractère.",
      body: "Découvrez une collection inspirée, pensée pour le quotidien, les occasions et les grandes célébrations.", cta: "Voir la collection", secondaryCta: "Notre histoire", nav: ["Nouveautés", "Femme", "Homme", "Accessoires"],
      color: "#7b3f35", soft: "#f5e9e5", dark: "#261b19", heroImage: img("photo-1483985988355-763728e1935b"),
      features: ["Collections saisonnières", "Tailles & couleurs", "Commande personnalisée"],
      cards: [
        { title: "Ensemble signature", type: "Nouvelle collection", price: "À partir de 35 000 F", image: img("photo-1539109136881-3be0616acf4b") },
        { title: "Sac tissé", type: "Accessoires", price: "18 000 F", image: img("photo-1584917865442-de89df76afd3") },
        { title: "Tenue cérémonie", type: "Pièce sélectionnée", price: "Sur commande", image: img("photo-1490481651871-ab68de25d43d") }
      ]
    },
    {
      id: "beauty", number: "03", name: "Beauté & cosmétiques", sector: "Beauté", glyph: "BC", layout: "beauty",
      useCase: "Boutiques de cosmétiques, soins, parfums et coffrets beauté.",
      recommendedPages: ["Soins visage","Soins corps","Conseils et routines","Livraison et retours"],
      managementModules: ["Produits","Catégories et routines","Stock","Commandes","Promotions","Pages et médias"],
      customerJourney: "Trouver un soin → consulter sa fiche → commander via WhatsApp",
      catalogLabel: "Soins et produits",
      orderMode: "whatsapp",
      description: "Soins, routines et coffrets beauté.", demoBrand: "NAYA BEAUTÉ", location: "Dakar, Sénégal",
      eyebrow: "VOTRE ROUTINE, VOTRE ÉCLAT", headline: "Prendre soin de soi, naturellement.", tagline: "Des gestes simples, une beauté qui vous ressemble.",
      body: "Des soins soigneusement sélectionnés pour accompagner vos routines visage, corps et cheveux.", cta: "Découvrir les soins", secondaryCta: "Trouver ma routine", nav: ["Visage", "Corps", "Cheveux", "Coffrets"],
      color: "#a34e62", soft: "#faedf0", dark: "#44252d", heroImage: img("photo-1608248543803-ba4f8c70ae0b"),
      features: ["Routines par besoin", "Fiches produits", "Coffrets cadeaux"],
      cards: [
        { title: "Rituel éclat", type: "Routine visage", price: "12 500 F", image: img("photo-1556228720-195a672e8a03") },
        { title: "Soin hydratant", type: "Soin quotidien", price: "8 000 F", image: img("photo-1601049541289-9b1b7bbbfe19") },
        { title: "Coffret douceur", type: "Idée cadeau", price: "18 000 F", image: img("photo-1608571423902-eed4a5ad8108") }
      ]
    },
    {
      id: "electronics", number: "04", name: "Électronique & accessoires", sector: "Électronique", glyph: "EA", layout: "electronics",
      useCase: "Vendeurs de téléphones, informatique, audio et appareils nécessitant des caractéristiques ou garanties.",
      recommendedPages: ["Téléphonie","Informatique","Garanties et SAV","Livraison"],
      managementModules: ["Produits et références","Caractéristiques techniques","Stock","Commandes","Garanties et SAV","Pages et médias"],
      customerJourney: "Comparer les caractéristiques → vérifier la disponibilité → commander via WhatsApp",
      catalogLabel: "Équipements",
      orderMode: "whatsapp",
      description: "Fiches techniques, références et garanties.", demoBrand: "PIXEL STORE", location: "Dakar, Sénégal",
      eyebrow: "TECHNOLOGIE AU QUOTIDIEN", headline: "Les bons équipements. Sans détour.", tagline: "La tech utile, avec un service fiable.",
      body: "Comparez les caractéristiques, vérifiez la disponibilité et trouvez l’équipement adapté à vos besoins.", cta: "Découvrir les produits", secondaryCta: "Conseil & assistance", nav: ["Smartphones", "Informatique", "Audio", "Accessoires"],
      color: "#2463eb", soft: "#e8efff", dark: "#101a34", heroImage: img("photo-1498049794561-7780e7231661"),
      features: ["Caractéristiques détaillées", "Disponibilité visible", "Garantie précisée"],
      cards: [
        { title: "Smartphone Nova", type: "Téléphonie", price: "À partir de 95 000 F", image: img("photo-1511707171634-5f897ff02aa9") },
        { title: "Casque sans fil", type: "Audio", price: "28 000 F", image: img("photo-1505740420928-5e560c06d30e") },
        { title: "Montre connectée", type: "Objets connectés", price: "42 000 F", image: img("photo-1523275335684-37898b6baf30") }
      ]
    },
    {
      id: "home", number: "05", name: "Maison & ameublement", sector: "Maison", glyph: "MA", layout: "home",
      useCase: "Magasins de meubles, décoration, cuisine et aménagement intérieur.",
      recommendedPages: ["Salon","Chambre","Décoration","Livraison et installation"],
      managementModules: ["Produits","Dimensions et variantes","Stock ou disponibilité","Demandes de devis","Commandes","Pages et médias"],
      customerJourney: "Explorer les univers → consulter dimensions et prix → commander ou demander un devis via WhatsApp",
      catalogLabel: "Mobilier et décoration",
      orderMode: "whatsapp",
      description: "Mobilier, décoration et équipements.", demoBrand: "MAISON TERANGA", location: "Dakar, Sénégal",
      eyebrow: "UN INTÉRIEUR QUI VOUS RESSEMBLE", headline: "Faites de votre maison un lieu à part.", tagline: "Des objets pensés pour vivre mieux.",
      body: "Mobilier, décoration et pièces choisies pour créer des espaces accueillants, pratiques et durables.", cta: "Explorer la sélection", secondaryCta: "Conseils déco", nav: ["Salon", "Chambre", "Décoration", "Sur mesure"],
      color: "#98633e", soft: "#f4eee6", dark: "#3c2b20", heroImage: img("photo-1555041469-a586c61ea9bc"),
      features: ["Galeries inspirantes", "Dimensions détaillées", "Livraison à organiser"],
      cards: [
        { title: "Canapé Niani", type: "Salon", price: "Sur devis", image: img("photo-1555041469-a586c61ea9bc") },
        { title: "Table en bois", type: "Salle à manger", price: "À partir de 95 000 F", image: img("photo-1449247709967-d4461a6a6103") },
        { title: "Lampe sculpturale", type: "Décoration", price: "24 000 F", image: img("photo-1507473885765-e6ed057f782c") }
      ]
    },
    {
      id: "grocery", number: "06", name: "Épicerie & produits locaux", sector: "Alimentation", glyph: "EP", layout: "grocery",
      useCase: "Épiceries, commerces alimentaires, producteurs locaux et paniers de produits.",
      recommendedPages: ["Épicerie","Produits frais","Paniers","Zones et horaires de livraison"],
      managementModules: ["Produits","Formats et lots","Stock","Commandes","Zones de livraison","Pages et médias"],
      customerJourney: "Composer son panier → choisir les modalités de réception → commander via WhatsApp",
      catalogLabel: "Produits et paniers",
      orderMode: "whatsapp",
      description: "Paniers, lots, formats et livraison.", demoBrand: "KËR MARKET", location: "Dakar, Sénégal",
      eyebrow: "LE BON GOÛT DU LOCAL", headline: "Les bons produits, près de chez vous.", tagline: "Le meilleur du marché, plus simplement.",
      body: "Composez votre panier avec des produits du quotidien, des spécialités locales et des formats familiaux.", cta: "Composer mon panier", secondaryCta: "Nos producteurs", nav: ["Fruits & légumes", "Épicerie", "Produits locaux", "Paniers"],
      color: "#287544", soft: "#eef6df", dark: "#183821", heroImage: img("photo-1542838132-92c53300491e"),
      features: ["Produits par catégorie", "Paniers préparés", "Créneaux de livraison"],
      cards: [
        { title: "Panier Teranga", type: "Sélection de saison", price: "12 000 F", image: img("photo-1540420773420-3366772f4999") },
        { title: "Céréales locales", type: "Production locale", price: "À partir de 2 500 F", image: img("photo-1574323347407-f5e1ad6d020b") },
        { title: "Huile & essentiels", type: "Épicerie", price: "Selon format", image: img("photo-1474979266404-7eaacbcd87c5") }
      ]
    },
    {
      id: "restaurant", number: "07", name: "Restaurant & fast-food", sector: "Restauration", glyph: "RF", layout: "restaurant",
      useCase: "Restaurants, fast-foods et traiteurs proposant des plats, options et commandes à emporter ou en livraison.",
      recommendedPages: ["Menu","Plats du jour","Livraison et retrait","Horaires et allergènes"],
      managementModules: ["Menu et catégories","Plats et suppléments","Disponibilité par service","Commandes","Horaires et livraison","Pages et médias"],
      customerJourney: "Consulter le menu → choisir les options → envoyer la commande via WhatsApp",
      catalogLabel: "Menu",
      orderMode: "whatsapp",
      description: "Menu, options, panier et commandes.", demoBrand: "LE BOL DAKAROIS", location: "Dakar, Sénégal",
      eyebrow: "CUISINÉ AVEC GÉNÉROSITÉ", headline: "Les saveurs qui rassemblent.", tagline: "Du goût, du partage et du fait maison.",
      body: "Parcourez le menu, choisissez vos accompagnements et passez commande pour le déjeuner ou le dîner.", cta: "Voir le menu", secondaryCta: "Nos horaires", nav: ["Menu", "Nos spécialités", "Livraison", "Contact"],
      color: "#c35b35", soft: "#fff0e6", dark: "#241915", heroImage: img("photo-1517248135467-4c7edcad34c4"),
      features: ["Menu actualisable", "Suppléments et options", "Commande à emporter"],
      cards: [
        { title: "Yassa poulet", type: "Spécialité maison", price: "4 500 F", image: img("photo-1512621776951-a57141f2eefd") },
        { title: "Mafé traditionnel", type: "Plat du jour", price: "4 000 F", image: img("photo-1547592180-85f173990554") },
        { title: "Burger maison", type: "À emporter", price: "3 500 F", image: img("photo-1568901346375-23c9450c58cd") }
      ]
    },
    {
      id: "bakery", number: "08", name: "Boulangerie & traiteur", sector: "Boulangerie", glyph: "BT", layout: "bakery",
      useCase: "Boulangeries, pâtisseries et traiteurs avec commandes anticipées et créations personnalisées.",
      recommendedPages: ["Pains et viennoiseries","Pâtisseries","Gâteaux personnalisés","Événements"],
      managementModules: ["Produits et menus","Tailles et options","Disponibilité et délais","Commandes anticipées","Demandes personnalisées","Pages et médias"],
      customerJourney: "Choisir une création → préciser les options et la date → commander via WhatsApp",
      catalogLabel: "Carte et créations",
      orderMode: "whatsapp",
      description: "Pâtisseries, commandes anticipées et événements.", demoBrand: "FOUR & DOUCEUR", location: "Dakar, Sénégal",
      eyebrow: "FAIT AVEC SOIN, PARTAGÉ AVEC JOIE", headline: "Les petits plaisirs des beaux jours.", tagline: "Du four à votre table, tout en douceur.",
      body: "Pains, pâtisseries et créations sur commande pour vos petits-déjeuners, fêtes et moments en famille.", cta: "Découvrir la carte", secondaryCta: "Commander un gâteau", nav: ["Pains", "Pâtisseries", "Gâteaux", "Événements"],
      color: "#a95a2a", soft: "#fff1dc", dark: "#422716", heroImage: img("photo-1509440159596-0249088772ff"),
      features: ["Commandes à l’avance", "Gâteaux personnalisés", "Retrait ou livraison"],
      cards: [
        { title: "Pain complet", type: "Boulangerie", price: "800 F", image: img("photo-1585478259715-876acc5be8eb") },
        { title: "Gâteau de fête", type: "Sur commande", price: "À partir de 20 000 F", image: img("photo-1578985545062-69928b1d9587") },
        { title: "Boîte de douceurs", type: "À partager", price: "6 500 F", image: img("photo-1499636136210-6f4ee915583e") }
      ]
    },
    {
      id: "services", number: "09", name: "Auto & moto", sector: "Auto & moto", glyph: "AM", layout: "catalog",
      useCase: "Boutique de pièces, accessoires auto/moto et équipements d’entretien sourcés chez des vendeurs en ligne.",
      recommendedPages: ["Pièces auto","Accessoires moto","Équipements","Livraison","Contact"],
      managementModules: ["Catalogue auto et moto","Références et compatibilité","Sources fournisseurs","Comparaison des prix","Pages et médias","Livraison"],
      customerJourney: "Comparer une référence → vérifier le prix fournisseur → commander en ligne → confirmer la livraison",
      catalogLabel: "Pièces & accessoires",
      orderMode: "whatsapp",
      description: "Pièces auto, accessoires moto et équipements de mobilité.", demoBrand: "SAMA AUTO & MOTO", location: "Dakar, Sénégal",
      eyebrow: "PIÈCES ET ACCESSOIRES AUTO & MOTO", headline: "Les bons équipements, sans détour.", tagline: "Des références utiles pour chaque trajet.",
      body: "Découvre une sélection de pièces et d’accessoires sourcés en ligne. La compatibilité, la disponibilité et le prix final sont confirmés avant l’achat.", cta: "Explorer le catalogue", secondaryCta: "Voir les nouveautés", nav: ["Pièces auto","Moto","Accessoires","Livraison"],
      color: "#2454a6", soft: "#eaf1fc", dark: "#172b4d", heroImage: img("photo-1503376780353-7e6692767b70"),
      features: ["Références détaillées","Prix source vérifié","Livraison organisée"],
      cards: [
        { title: "Nettoyage professionnel", type: "Bureaux & locaux", price: "Sur devis", image: img("photo-1527515637462-cff94eecc1ac") },
        { title: "Maintenance", type: "Entretien régulier", price: "Sur devis", image: img("photo-1581578731548-c64695cc6952") },
        { title: "Intervention ponctuelle", type: "Besoin spécifique", price: "Sur devis", image: img("photo-1581092921461-eab62e97a780") }
      ]
    },
    {
      id: "realestate", number: "10", name: "Sport & loisirs", sector: "Sport & loisirs", glyph: "SL", layout: "catalog",
      useCase: "Boutique d’équipements sportifs, fitness, randonnée et loisirs référencés auprès de vendeurs en ligne.",
      recommendedPages: ["Fitness","Sports collectifs","Plein air","Accessoires","Livraison"],
      managementModules: ["Catalogue sport et fitness","Tailles et variantes","Sources fournisseurs","Comparaison des prix","Pages et médias","Livraison"],
      customerJourney: "Explorer les équipements → consulter les caractéristiques → vérifier le prix source → commander",
      catalogLabel: "Équipements sportifs",
      orderMode: "whatsapp",
      description: "Fitness, sport, randonnée et accessoires de loisirs.", demoBrand: "SAMA SPORT & LOISIRS", location: "Dakar, Sénégal",
      eyebrow: "SPORT, MOUVEMENT ET PLEIN AIR", headline: "Équipe-toi pour aller plus loin.", tagline: "Le bon équipement pour tes objectifs.",
      body: "Explore des équipements pour l’entraînement, les sports collectifs et les sorties en plein air. Chaque fiche active doit référencer un vendeur en ligne et un prix récemment vérifié.", cta: "Explorer les équipements", secondaryCta: "Voir les nouveautés", nav: ["Fitness","Sports","Plein air","Accessoires"],
      color: "#17633d", soft: "#e5f1da", dark: "#153c2c", heroImage: img("photo-1517836357463-d25dfeac3438"),
      features: ["Caractéristiques claires","Prix source vérifié","Livraison organisée"],
      cards: [
        { title: "Appartement lumineux", type: "Location · Almadies", price: "450 000 F / mois", image: img("photo-1600607687939-ce8a6c25118c") },
        { title: "Villa familiale", type: "Vente · Ngor", price: "Sur demande", image: img("photo-1600585154340-be6161a56a0c") },
        { title: "Studio moderne", type: "Location · Mermoz", price: "250 000 F / mois", image: img("photo-1600210492486-724fe5c67fb0") }
      ]
    }
  ];
})();
