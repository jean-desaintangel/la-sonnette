/**
 * galerie.js — La Sonnette · Galerie photos
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ce fichier gère deux grandes fonctionnalités :
 *
 *  1. FILTRE PAR CATÉGORIE
 *     L'utilisateur clique sur un bouton ("Tous", "Afterwork", etc.)
 *     → on affiche uniquement les photos de cette catégorie.
 *     → les autres photos sont masquées via l'attribut HTML "hidden".
 *
 *  2. LIGHTBOX (visionneuse plein écran)
 *     L'utilisateur clique sur une photo → elle s'agrandit dans une modale.
 *     → Navigation avec les boutons Précédent / Suivant ou les touches ← →
 *     → Fermeture avec la touche Échap ou en cliquant sur le fond sombre
 *     → Piège de focus : la touche Tab ne sort pas de la modale (accessibilité)
 *
 * ─── SÉCURITÉ ──────────────────────────────────────────────────────
 *  - Les éléments visuels sont créés avec createElement(), jamais innerHTML,
 *    pour éviter les attaques XSS (injection de code malveillant).
 *  - Les textes (légendes) sont insérés via textContent, jamais innerHTML,
 *    pour la même raison : textContent échappe automatiquement les balises HTML.
 *  - On vérifie toujours l'existence d'un élément avant de le manipuler.
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';
// "use strict" active le mode strict de JavaScript :
// il interdit les mauvaises pratiques (variables non déclarées, etc.)
// et rend les erreurs plus faciles à trouver.


/* ─────────────────────────────────────────────────────────────────
   ÉTAT GLOBAL DE LA GALERIE
   ─────────────────────────────────────────────────────────────────
   On regroupe toutes les données "vivantes" de la galerie dans un
   seul objet. C'est plus propre que d'avoir des variables éparpillées.
   Cela s'appelle un "état centralisé" (pattern courant en développement web).
   ───────────────────────────────────────────────────────────────── */
const etatGalerie = {

  /**
   * Liste de TOUTES les photos de la galerie (indépendamment du filtre actif).
   * On la remplit une seule fois au chargement de la page.
   * @type {Element[]}  ← Element[] signifie "tableau d'éléments HTML"
   */
  toutesLesPhotos: [],

  /**
   * Liste des photos ACTUELLEMENT VISIBLES après application du filtre.
   * Si le filtre est "Tous", cette liste est identique à toutesLesPhotos.
   * C'est cette liste qu'on utilise pour la navigation dans la lightbox.
   * @type {Element[]}
   */
  photosVisiblesApresFiltre: [],

  /**
   * Position (numéro) de la photo actuellement ouverte dans la lightbox.
   * 0 = première photo, 1 = deuxième, etc.
   * @type {number}
   */
  positionPhotoOuverte: 0,
};

/**
 * Mémorisation de l'élément qui avait le focus AVANT l'ouverture de la lightbox.
 * Quand on ferme la lightbox, on redonne le focus à cet élément.
 * → Bonne pratique d'accessibilité : l'utilisateur clavier retrouve son point de départ.
 *
 * POURQUOI "let" et pas "const" ?
 *   → Parce que cette valeur change à chaque ouverture de la lightbox.
 *
 * POURQUOI déclarer cette variable ICI, tout en haut du fichier ?
 *   → En JavaScript, les variables "let" et "const" ne sont PAS remontées
 *     (contrairement à "var"). Si on déclarait cette variable plus bas,
 *     la fonction ouvrirLightbox() ne pourrait pas y accéder et planterait
 *     avec une "ReferenceError". On déclare donc en haut pour être sûr.
 *     Ce phénomène s'appelle la "zone morte temporelle" (Temporal Dead Zone).
 *
 * @type {Element|null}  ← null = "pas de valeur pour l'instant"
 */
let elementFocaliseAvantLightbox = null;


/* ─────────────────────────────────────────────────────────────────
   1. FILTRE PAR CATÉGORIE
   ─────────────────────────────────────────────────────────────────
   Principe :
     - Chaque photo HTML a un attribut data-categorie="afterwork" (par exemple).
     - Quand l'utilisateur clique sur un bouton, on lit sa data-filtre.
     - On compare : si la photo appartient à cette catégorie, on l'affiche,
       sinon on la cache.
   ───────────────────────────────────────────────────────────────── */

/**
 * Applique un filtre : affiche les photos de la catégorie demandée,
 * cache toutes les autres.
 *
 * @param {string} categorieChoisie - La catégorie à afficher.
 *   Valeur spéciale : 'tous' → affiche toutes les photos sans exception.
 *   Autres valeurs possibles : 'afterwork', 'secret-santa', 'photobooth', etc.
 */
function appliquerFiltre(categorieChoisie) {

  // On repart d'une liste vide : on va la reconstruire selon le filtre.
  etatGalerie.photosVisiblesApresFiltre = [];

  // On parcourt TOUTES les photos de la galerie, une par une.
  etatGalerie.toutesLesPhotos.forEach(elementPhoto => {

    // On lit la catégorie de cette photo dans son attribut HTML data-categorie.
    // Exemple HTML : <article class="galerie__item" data-categorie="afterwork">
    const categorieDeCettePhoto = elementPhoto.dataset.categorie;

    // Cette photo doit-elle être visible ?
    // OUI si : le filtre est "tous"  OU  la catégorie de la photo correspond au filtre.
    const cettePhotoDoitEtreVisible =
      (categorieChoisie === 'tous') || (categorieDeCettePhoto === categorieChoisie);

    if (cettePhotoDoitEtreVisible) {

      // AFFICHER la photo : on retire l'attribut "hidden" qui la masquait.
      // L'attribut HTML hidden est l'équivalent de display:none, mais plus sémantique.
      elementPhoto.removeAttribute('hidden');

      // Ajouter une animation d'apparition pour un effet visuel agréable.
      // La classe CSS "entree-filtre" déclenche une animation définie dans style.css.
      elementPhoto.classList.add('entree-filtre');

      // Retirer la classe d'animation après 400ms.
      // POURQUOI ? Pour qu'elle puisse se rejouer si l'utilisateur rechange de filtre.
      // Si on ne la retirait pas, l'animation ne se rejouerait pas (déjà appliquée).
      setTimeout(() => elementPhoto.classList.remove('entree-filtre'), 400);

      // Ajouter cette photo à la liste des photos visibles.
      // Cette liste servira pour la navigation dans la lightbox.
      etatGalerie.photosVisiblesApresFiltre.push(elementPhoto);

    } else {

      // CACHER la photo : on ajoute l'attribut hidden.
      // setAttribute('hidden', '') est équivalent à écrire hidden="" dans le HTML.
      elementPhoto.setAttribute('hidden', '');
    }
  });
}

/**
 * Met en place les boutons de filtre au chargement de la page.
 * Cette fonction est appelée une seule fois, lors de l'initialisation.
 *
 * Elle fait trois choses :
 *   1. Récupère tous les éléments nécessaires dans le DOM.
 *   2. Remplit etatGalerie.toutesLesPhotos avec les articles de la grille.
 *   3. Attache un écouteur de clic sur chaque bouton de filtre.
 */
function initialiserBoutonsDeFiltres() {

  // Récupérer tous les boutons de filtre (les éléments avec la classe "filtre").
  const tousBoutonsDeFiltres = document.querySelectorAll('.filtre');

  // Récupérer la grille HTML qui contient toutes les photos.
  const grilleDePhotos = document.getElementById('grille-galerie');

  // Sécurité : si la grille ou les boutons n'existent pas dans la page,
  // on arrête ici pour éviter des erreurs JavaScript.
  if (!grilleDePhotos || !tousBoutonsDeFiltres.length) return;

  // Remplir la liste de toutes les photos (une seule fois).
  // Array.from() convertit une NodeList (résultat de querySelectorAll)
  // en vrai tableau JavaScript, pour pouvoir utiliser .forEach, .filter, etc.
  etatGalerie.toutesLesPhotos = Array.from(
    grilleDePhotos.querySelectorAll('.galerie__item')
  );

  // Au départ (aucun filtre actif), toutes les photos sont visibles.
  // [...tableau] est la syntaxe "spread" : elle crée une copie du tableau.
  // On fait une copie pour ne pas modifier toutesLesPhotos par accident.
  etatGalerie.photosVisiblesApresFiltre = [...etatGalerie.toutesLesPhotos];

  // Pour chaque bouton de filtre, on ajoute un écouteur de clic.
  tousBoutonsDeFiltres.forEach(boutonDeFiltreActuel => {
    boutonDeFiltreActuel.addEventListener('click', () => {

      // Lire la catégorie associée à ce bouton.
      // Exemple HTML : <button class="filtre" data-filtre="afterwork">Afterwork</button>
      const categorieChoisieParLUtilisateur = boutonDeFiltreActuel.dataset.filtre;

      // Réinitialiser l'état visuel de TOUS les boutons (retirer la mise en surbrillance).
      // On parcourt tous les boutons pour en désactiver l'état "actif".
      tousBoutonsDeFiltres.forEach(unAutreBouton => {
        unAutreBouton.classList.remove('actif');
        // aria-pressed indique aux lecteurs d'écran si ce bouton est "enfoncé" ou non.
        // false = bouton relâché (non sélectionné).
        unAutreBouton.setAttribute('aria-pressed', 'false');
      });

      // Activer visuellement LE bouton qui vient d'être cliqué.
      boutonDeFiltreActuel.classList.add('actif');
      boutonDeFiltreActuel.setAttribute('aria-pressed', 'true');
      // true = bouton enfoncé (sélectionné) → les lecteurs d'écran annoncent le changement.

      // Lancer l'application du filtre sur les photos.
      appliquerFiltre(categorieChoisieParLUtilisateur);
    });
  });
}


/* ─────────────────────────────────────────────────────────────────
   2. LIGHTBOX (visionneuse plein écran)
   ─────────────────────────────────────────────────────────────────
   La lightbox est une modale HTML cachée par défaut (attribut hidden).
   Quand l'utilisateur clique sur une photo, on retire "hidden" pour l'afficher.
   On charge l'image agrandie dans la modale, puis on gère la navigation.
   ───────────────────────────────────────────────────────────────── */

/**
 * Références aux éléments HTML de la lightbox.
 *
 * On utilise des "getters" (mot-clé "get") plutôt que des variables simples.
 * POURQUOI ? Parce que si on stockait les éléments une fois pour toutes au
 * chargement, et qu'un élément était absent du DOM à ce moment-là, on aurait
 * "null" en permanence. Avec les getters, on interroge le DOM à chaque accès,
 * ce qui est plus robuste (mais légèrement plus lent — acceptable ici).
 *
 * Exemple d'utilisation : domLightbox.boite → renvoie l'élément #lightbox
 */
const domLightbox = {
  /** La boîte principale de la lightbox (la modale elle-même). */
  get boite()              { return document.getElementById('lightbox'); },

  /** Le fond sombre semi-transparent derrière la photo. */
  get fondSombre()         { return document.getElementById('lightbox-fond'); },

  /** La zone où on affiche la photo agrandie. */
  get zoneMedia()          { return document.getElementById('lightbox-media'); },

  /** La zone texte affichant le titre/légende de la photo. */
  get zoneLegende()        { return document.getElementById('lightbox-legende'); },

  /** Le bouton pour fermer la lightbox (croix ×). */
  get boutonFermer()       { return document.getElementById('lightbox-fermer'); },

  /** Le bouton pour passer à la photo suivante (→). */
  get boutonSuivant()      { return document.getElementById('lightbox-suivant'); },

  /** Le bouton pour revenir à la photo précédente (←). */
  get boutonPrecedent()    { return document.getElementById('lightbox-precedent'); },
};

/**
 * Ouvre la lightbox et affiche la photo à la position demandée.
 *
 * @param {number} positionDansLaListeVisible - Numéro (index) de la photo
 *   dans etatGalerie.photosVisiblesApresFiltre (commence à 0).
 */
function ouvrirLightbox(positionDansLaListeVisible) {

  // Sécurité : si les éléments HTML de la lightbox n'existent pas, on arrête.
  if (!domLightbox.boite || !domLightbox.fondSombre) return;

  // Sécurité : si la position demandée est en dehors de la liste, on arrête.
  // Exemple : si on demande la photo n°10 mais qu'il n'y en a que 5, on arrête.
  if (
    positionDansLaListeVisible < 0 ||
    positionDansLaListeVisible >= etatGalerie.photosVisiblesApresFiltre.length
  ) return;

  // Mémoriser la position de la photo ouverte (pour la navigation suivant/précédent).
  etatGalerie.positionPhotoOuverte = positionDansLaListeVisible;

  // Mémoriser l'élément HTML qui avait le focus AVANT l'ouverture.
  // document.activeElement renvoie l'élément actuellement focalisé (bouton cliqué, etc.)
  // → On en aura besoin quand on fermera la lightbox pour y revenir.
  elementFocaliseAvantLightbox = document.activeElement;

  // Charger l'image dans la zone d'affichage de la lightbox.
  chargerImageDansLightbox(positionDansLaListeVisible);

  // Mettre à jour l'état des boutons Précédent/Suivant
  // (les désactiver si on est au début ou à la fin de la liste).
  mettreAJourBoutonsNavigation();

  // AFFICHER la lightbox : on retire l'attribut hidden sur la boîte et le fond.
  domLightbox.boite.removeAttribute('hidden');
  domLightbox.fondSombre.removeAttribute('hidden');

  // Bloquer le défilement (scroll) de la page derrière la lightbox.
  // Sinon l'utilisateur pourrait faire défiler la page pendant que la lightbox est ouverte.
  document.body.style.overflow = 'hidden';

  // Donner le focus au bouton de fermeture.
  // L'opérateur ?. (optional chaining) évite une erreur si boutonFermer est null.
  // → L'utilisateur clavier peut immédiatement appuyer sur Entrée pour fermer.
  domLightbox.boutonFermer?.focus();
}

/**
 * Charge et affiche la photo (et sa légende) dans la lightbox.
 *
 * SÉCURITÉ : on utilise createElement() pour créer le tag <img>,
 * et on assigne src/alt directement sur l'objet JavaScript.
 * On n'utilise JAMAIS innerHTML = "<img src='...'>" car cela permettrait
 * à un attaquant d'injecter du code malveillant (attaque XSS).
 *
 * @param {number} positionDansLaListeVisible - Numéro de la photo à charger.
 */
function chargerImageDansLightbox(positionDansLaListeVisible) {

  // Récupérer l'élément HTML de la photo demandée dans la liste des visibles.
  const elementPhotoAOuvrir = etatGalerie.photosVisiblesApresFiltre[positionDansLaListeVisible];

  // Sécurité : si l'élément ou la zone d'affichage n'existe pas, on arrête.
  if (!elementPhotoAOuvrir || !domLightbox.zoneMedia) return;

  // Vider le contenu précédent de la zone d'affichage
  // (la photo qui était affichée avant, si l'utilisateur navigue).
  domLightbox.zoneMedia.innerHTML = '';

  // Trouver la balise <img> à l'intérieur de l'élément photo de la galerie.
  // C'est elle qui contient l'URL (src) et le texte alternatif (alt) de l'image.
  const baliseImageOriginale = elementPhotoAOuvrir.querySelector('img');

  if (baliseImageOriginale) {

    // Créer un NOUVEL élément <img> pour la lightbox.
    // On ne réutilise pas l'original pour ne pas perturber la galerie.
    const nouvelleImageAgrandie = document.createElement('img');

    // Copier l'URL de l'image source → la lightbox affichera la même image.
    nouvelleImageAgrandie.src = baliseImageOriginale.src;

    // Copier le texte alternatif → indispensable pour les lecteurs d'écran.
    // Le texte alt décrit l'image pour les personnes malvoyantes.
    nouvelleImageAgrandie.alt = baliseImageOriginale.alt;

    // Limiter la taille de l'image pour qu'elle ne déborde pas de l'écran.
    // 90vw = 90% de la largeur de la fenêtre ; 75vh = 75% de la hauteur.
    nouvelleImageAgrandie.style.maxWidth  = '90vw';
    nouvelleImageAgrandie.style.maxHeight = '75vh';

    // Insérer l'image dans la zone d'affichage de la lightbox.
    domLightbox.zoneMedia.appendChild(nouvelleImageAgrandie);
  }

  // Récupérer la légende (titre) de la photo depuis la galerie.
  // Elle se trouve dans un élément avec la classe "polaroid__legende".
  const baliseLegendeOriginale = elementPhotoAOuvrir.querySelector('.polaroid__legende');

  if (domLightbox.zoneLegende && baliseLegendeOriginale) {
    // Copier le texte de la légende avec textContent (jamais innerHTML).
    // textContent copie le texte brut et échappe les balises HTML éventuelles.
    domLightbox.zoneLegende.textContent = baliseLegendeOriginale.textContent;
  }
}

/**
 * Met à jour l'apparence des boutons Précédent et Suivant.
 *
 * Si on est sur la première photo → Précédent est désactivé (grisé).
 * Si on est sur la dernière photo  → Suivant est désactivé (grisé).
 * Pour les photos du milieu       → les deux boutons sont actifs.
 */
function mettreAJourBoutonsNavigation() {

  // Raccourci : on extrait ces deux valeurs de l'état pour ne pas répéter
  // "etatGalerie.xxx" partout dans la fonction.
  const { positionPhotoOuverte, photosVisiblesApresFiltre } = etatGalerie;

  // Nombre total de photos visibles (pour savoir si on est à la fin).
  const nombreTotalDePhotosVisibles = photosVisiblesApresFiltre.length;

  if (domLightbox.boutonPrecedent) {
    // On est sur la première photo si positionPhotoOuverte === 0.
    const estSurLaPremierePhoto = positionPhotoOuverte <= 0;

    // "disabled" empêche de cliquer sur le bouton (et l'annonce aux lecteurs d'écran).
    domLightbox.boutonPrecedent.disabled = estSurLaPremierePhoto;

    // On rend le bouton grisé visuellement quand il est désactivé.
    domLightbox.boutonPrecedent.style.opacity = estSurLaPremierePhoto ? '0.3' : '1';
  }

  if (domLightbox.boutonSuivant) {
    // On est sur la dernière photo si positionPhotoOuverte === dernière position.
    const estSurLaDernierePhoto = positionPhotoOuverte >= nombreTotalDePhotosVisibles - 1;

    domLightbox.boutonSuivant.disabled = estSurLaDernierePhoto;
    domLightbox.boutonSuivant.style.opacity = estSurLaDernierePhoto ? '0.3' : '1';
  }
}

/**
 * Ferme la lightbox et remet tout dans l'état initial.
 *
 * Fait quatre choses :
 *   1. Cache la boîte et le fond sombre (attribut hidden).
 *   2. Vide la zone d'image (pour libérer la mémoire).
 *   3. Réactive le défilement de la page.
 *   4. Redonne le focus à l'élément qui l'avait avant l'ouverture.
 */
function fermerLightbox() {

  // Sécurité : si les éléments HTML n'existent pas, on arrête.
  if (!domLightbox.boite || !domLightbox.fondSombre) return;

  // CACHER la boîte et le fond en remettant l'attribut hidden.
  domLightbox.boite.setAttribute('hidden', '');
  domLightbox.fondSombre.setAttribute('hidden', '');

  // Vider la zone d'image : cela libère la mémoire du navigateur
  // (l'image n'est plus dans le DOM, le navigateur peut la désallouer).
  if (domLightbox.zoneMedia) domLightbox.zoneMedia.innerHTML = '';

  // Réactiver le scroll de la page (qu'on avait bloqué à l'ouverture).
  // Remettre la chaîne vide '' supprime le style inline et restaure la valeur CSS.
  document.body.style.overflow = '';

  // Rendre le focus à l'élément qui l'avait AVANT l'ouverture de la lightbox.
  // typeof ... === 'function' vérifie que la méthode .focus() existe bien sur l'élément.
  if (elementFocaliseAvantLightbox && typeof elementFocaliseAvantLightbox.focus === 'function') {
    elementFocaliseAvantLightbox.focus();
  }
}

/**
 * Passe à la photo SUIVANTE dans la lightbox.
 * Si on est déjà sur la dernière photo, ne fait rien.
 */
function afficherPhotoSuivante() {

  // On ne peut aller "suivant" que si on n'est pas déjà à la dernière photo.
  const pasEncoreDerniere =
    etatGalerie.positionPhotoOuverte < etatGalerie.photosVisiblesApresFiltre.length - 1;

  if (pasEncoreDerniere) {
    // Charger la photo à la position SUIVANTE (position actuelle + 1).
    chargerImageDansLightbox(etatGalerie.positionPhotoOuverte + 1);

    // Avancer le compteur de position.
    etatGalerie.positionPhotoOuverte++;

    // Mettre à jour l'état des boutons (l'un d'eux est peut-être maintenant désactivé).
    mettreAJourBoutonsNavigation();
  }
}

/**
 * Revient à la photo PRÉCÉDENTE dans la lightbox.
 * Si on est déjà sur la première photo, ne fait rien.
 */
function afficherPhotoPrecedente() {

  // On ne peut aller "précédent" que si on n'est pas déjà à la première photo.
  const pasDejaPremiere = etatGalerie.positionPhotoOuverte > 0;

  if (pasDejaPremiere) {
    // Charger la photo à la position PRÉCÉDENTE (position actuelle - 1).
    chargerImageDansLightbox(etatGalerie.positionPhotoOuverte - 1);

    // Reculer le compteur de position.
    etatGalerie.positionPhotoOuverte--;

    // Mettre à jour l'état des boutons.
    mettreAJourBoutonsNavigation();
  }
}

/**
 * Piège le focus à l'intérieur de la lightbox pendant qu'elle est ouverte.
 *
 * POURQUOI un "piège de focus" ?
 *   Par défaut, si l'utilisateur appuie sur Tab dans la lightbox, le focus
 *   peut sortir de la modale et atteindre des éléments cachés derrière.
 *   C'est problématique pour les utilisateurs clavier et les lecteurs d'écran.
 *   Cette fonction intercepte la touche Tab pour garder le focus dans la lightbox.
 *   C'est une exigence d'accessibilité (WCAG 2.1, critère 2.4.3).
 *
 * COMMENT ça marche ?
 *   - On liste tous les éléments focalisables dans la lightbox.
 *   - Si l'utilisateur est sur le DERNIER et appuie sur Tab → on va au PREMIER.
 *   - Si l'utilisateur est sur le PREMIER et appuie sur Shift+Tab → on va au DERNIER.
 *   Cela crée une "boucle" de focus à l'intérieur de la modale.
 *
 * @param {KeyboardEvent} evenementClavier - L'événement clavier déclenché.
 */
function piegerFocusDansLaLightbox(evenementClavier) {

  // Si la lightbox est cachée, il n'y a rien à faire.
  if (!domLightbox.boite || domLightbox.boite.hasAttribute('hidden')) return;

  // Trouver tous les éléments focalisables dans la lightbox.
  // On cherche : les boutons actifs + les éléments avec tabindex="0".
  // :not([disabled]) exclut les boutons désactivés.
  const tousLesElementsFocalisables = Array.from(
    domLightbox.boite.querySelectorAll(
      'button:not([disabled]), [tabindex="0"]'
    )
  );

  // S'il n'y a aucun élément focalisable, rien à faire.
  if (!tousLesElementsFocalisables.length) return;

  // Le premier et le dernier éléments focalisables de la lightbox.
  const premierElementFocalisable = tousLesElementsFocalisables[0];
  const dernierElementFocalisable  = tousLesElementsFocalisables[tousLesElementsFocalisables.length - 1];

  // On n'agit que si la touche pressée est Tab.
  if (evenementClavier.key === 'Tab') {

    if (evenementClavier.shiftKey) {
      // L'utilisateur appuie sur SHIFT + TAB (tab en arrière).
      // Si on est sur le premier élément → on saute au dernier (bouclage).
      if (document.activeElement === premierElementFocalisable) {
        evenementClavier.preventDefault(); // Empêche le comportement par défaut du navigateur.
        dernierElementFocalisable.focus();
      }
    } else {
      // L'utilisateur appuie sur TAB (tab en avant).
      // Si on est sur le dernier élément → on saute au premier (bouclage).
      if (document.activeElement === dernierElementFocalisable) {
        evenementClavier.preventDefault();
        premierElementFocalisable.focus();
      }
    }
  }
}

/**
 * Met en place tous les événements de la lightbox au chargement de la page.
 * Cette fonction est appelée une seule fois lors de l'initialisation.
 */
function initialiserLightbox() {

  // Récupérer la grille de photos (conteneur de tous les articles).
  const grilleDePhotos = document.getElementById('grille-galerie');

  // Sécurité : si la grille n'existe pas dans le HTML, on s'arrête.
  if (!grilleDePhotos) return;

  // ─── DÉLÉGATION D'ÉVÉNEMENTS ────────────────────────────────────
  // Au lieu d'attacher un écouteur de clic sur CHAQUE photo (N écouteurs),
  // on en attache UN SEUL sur la grille parente.
  // Quand l'utilisateur clique, l'événement "remonte" (bubble) jusqu'à la grille.
  // On vérifie alors si le clic venait bien d'un bouton de photo.
  // → Plus efficace en mémoire, et fonctionne même si des photos sont ajoutées dynamiquement.
  grilleDePhotos.addEventListener('click', (evenementDeClic) => {

    // evenementDeClic.target est l'élément exact qui a été cliqué (peut être l'image, un span, etc.)
    // .closest('.polaroid__bouton') remonte dans les ancêtres pour trouver le bouton parent.
    // Renvoie null si le clic n'était pas sur (ou dans) un .polaroid__bouton.
    const boutonPhotoClique = evenementDeClic.target.closest('.polaroid__bouton');

    // Si le clic n'était pas sur un bouton de photo, on ignore.
    if (!boutonPhotoClique) return;

    // Remonter encore d'un niveau pour trouver l'article .galerie__item parent.
    const articlePhotoClique = boutonPhotoClique.closest('.galerie__item');
    if (!articlePhotoClique) return;

    // Chercher la position de cet article dans la liste des photos visibles.
    // indexOf renvoie -1 si l'élément n'est pas trouvé (ne devrait pas arriver ici).
    const positionDeLaPhoto = etatGalerie.photosVisiblesApresFiltre.indexOf(articlePhotoClique);

    if (positionDeLaPhoto !== -1) {
      // Ouvrir la lightbox sur cette photo.
      ouvrirLightbox(positionDeLaPhoto);
    }
  });

  // ─── BOUTON FERMER ─────────────────────────────────────────────
  // L'opérateur ?. (optional chaining) : n'exécute addEventListener que si
  // boutonFermer n'est pas null (évite une erreur si le bouton est absent du HTML).
  domLightbox.boutonFermer?.addEventListener('click', fermerLightbox);

  // ─── BOUTONS DE NAVIGATION ─────────────────────────────────────
  domLightbox.boutonSuivant?.addEventListener('click', afficherPhotoSuivante);
  domLightbox.boutonPrecedent?.addEventListener('click', afficherPhotoPrecedente);

  // ─── CLIC SUR LE FOND SOMBRE ───────────────────────────────────
  // Si l'utilisateur clique à côté de la photo (sur le fond sombre), on ferme.
  domLightbox.fondSombre?.addEventListener('click', fermerLightbox);

  // ─── RACCOURCIS CLAVIER ────────────────────────────────────────
  // On écoute les touches clavier sur tout le document.
  document.addEventListener('keydown', (evenementClavier) => {

    // Si la lightbox est cachée, les raccourcis ne doivent pas fonctionner.
    // hasAttribute('hidden') vérifie si la lightbox est actuellement fermée.
    if (domLightbox.boite?.hasAttribute('hidden')) return;

    // Traiter la touche appuyée selon son nom.
    switch (evenementClavier.key) {

      case 'Escape':
        // Touche Échap → fermer la lightbox.
        fermerLightbox();
        break;

      case 'ArrowRight':
        // Flèche droite → photo suivante.
        afficherPhotoSuivante();
        break;

      case 'ArrowLeft':
        // Flèche gauche → photo précédente.
        afficherPhotoPrecedente();
        break;

      default:
        // Toute autre touche : on ne fait rien (le navigateur gère normalement).
        break;
    }

    // Quelle que soit la touche, on vérifie si le piège de focus doit agir.
    // (La fonction piegerFocusDansLaLightbox ne réagit qu'à la touche Tab.)
    piegerFocusDansLaLightbox(evenementClavier);
  });
}


/* ─────────────────────────────────────────────────────────────────
   POINT D'ENTRÉE — INITIALISATION AU CHARGEMENT DE LA PAGE
   ─────────────────────────────────────────────────────────────────
   'DOMContentLoaded' est déclenché quand le HTML est entièrement analysé
   par le navigateur (mais avant que les images soient chargées).
   C'est le bon moment pour attacher des événements aux éléments HTML :
   ils existent dans le DOM, mais on n'a pas attendu toutes les images.
   ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // 1. Mettre en place les boutons de filtre par catégorie.
  initialiserBoutonsDeFiltres();

  // 2. Mettre en place la lightbox (visionneuse plein écran).
  initialiserLightbox();
});
