/**
 * formulaire.js — La Sonnette · Boîte à idées
 * ═══════════════════════════════════════════════════════════════════
 *
 * Responsabilités :
 *  - Validation côté client avant soumission
 *  - Stockage des idées dans localStorage (persistance entre rechargements)
 *  - Affichage compact des idées sous le formulaire
 *  - Mode admin (suppression / modification) protégé par hash SHA-256
 *
 * SÉCURITÉ :
 *  - Pas d'innerHTML avec des données utilisateur → textContent uniquement
 *  - Le mot de passe admin n'est pas stocké en clair : seul son hash SHA-256
 *    est présent dans ce fichier. La vérification se fait via SubtleCrypto.
 */

'use strict';


/* ─────────────────────────────────────────────────────────────────
   CONFIGURATION
   ───────────────────────────────────────────────────────────────── */

const CLE_STOCKAGE = 'sonnette_idees';

/**
 * Hash SHA-256 du mot de passe admin (le mot de passe en clair n'apparaît pas ici).
 * Généré avec : echo -n "<votre-mot-de-passe>" | sha256sum
 */
const HASH_ADMIN = 'cc6255797ea7c55e8c7124dd864822ecb8aee3e7b349197a3b1bf401c8d8175d';

const REGLES_VALIDATION = {
  nom: {
    longueurMax: 100,
    pattern: /^[^<>&"]{1,100}$/,
    messageVide: 'Ce champ est obligatoire.',
    messageTropLong: 'Maximum 100 caractères.',
    messageInvalide: 'Caractères non autorisés.',
  },
  description: {
    longueurMax: 500,
    pattern: /^[^<>&"]{1,500}$/,
    messageVide: 'Ce champ est obligatoire.',
    messageTropLong: 'Maximum 500 caractères.',
    messageInvalide: 'Caractères non autorisés.',
  },
  pseudo: {
    longueurMax: 50,
    pattern: /^[^<>&"]{0,50}$/,
    messageTropLong: 'Maximum 50 caractères.',
    messageInvalide: 'Caractères non autorisés.',
  },
};

const LABELS_TYPE = {
  lieu: '🍺 Lieu',
  evenement: '🎉 Événement',
};

/** État global : mode admin actif ou non */
let modeAdminActif = false;


/* ─────────────────────────────────────────────────────────────────
   UTILITAIRE — Hash SHA-256 via Web Crypto API
   ───────────────────────────────────────────────────────────────── */

/**
 * Calcule le hash SHA-256 d'une chaîne et retourne la représentation hexadécimale.
 * @param {string} texte
 * @returns {Promise<string>}
 */
async function sha256(texte) {
  // On encode la chaîne en bytes
  const encoder = new TextEncoder();
  const donnees = encoder.encode(texte);

  // SubtleCrypto effectue le hachage de manière native (plus rapide et sécurisé)
  const hashBuffer = await crypto.subtle.digest('SHA-256', donnees);

  // Conversion du buffer en chaîne hexadécimale
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


/* ─────────────────────────────────────────────────────────────────
   VALIDATION
   ───────────────────────────────────────────────────────────────── */

function afficherErreurChamp(champ, message) {
  champ.classList.add('en-erreur');
  champ.setAttribute('aria-invalid', 'true');
  const erreur = champ.closest('.formulaire__champ')?.querySelector('.formulaire__erreur');
  if (erreur) erreur.textContent = message;
}

function effacerErreurChamp(champ) {
  champ.classList.remove('en-erreur');
  champ.setAttribute('aria-invalid', 'false');
  const erreur = champ.closest('.formulaire__champ')?.querySelector('.formulaire__erreur');
  if (erreur) erreur.textContent = '';
}

function effacerToutesLesErreurs(formulaire) {
  formulaire.querySelectorAll('.en-erreur').forEach(effacerErreurChamp);
}

function validerChamp(champ, nomChamp, obligatoire = true) {
  const regles = REGLES_VALIDATION[nomChamp];
  if (!regles) return true;
  const valeur = champ.value.trim();
  if (!valeur && obligatoire) { afficherErreurChamp(champ, regles.messageVide); return false; }
  if (valeur.length > regles.longueurMax) { afficherErreurChamp(champ, regles.messageTropLong); return false; }
  if (valeur && regles.pattern && !regles.pattern.test(valeur)) { afficherErreurChamp(champ, regles.messageInvalide); return false; }
  effacerErreurChamp(champ);
  return true;
}

function validerFormulaire(formulaire) {
  const champNom         = formulaire.querySelector('#champ-nom-lieu');
  const champDescription = formulaire.querySelector('#champ-description');
  const champPseudo      = formulaire.querySelector('#champ-pseudo');

  // On stocke chaque résultat AVANT de les combiner :
  // cela garantit que les 3 champs sont toujours validés (et leurs erreurs affichées),
  // même si le premier est déjà invalide — contrairement à &&, qui court-circuiterait.
  const nomValide         = validerChamp(champNom, 'nom', true);
  const descriptionValide = validerChamp(champDescription, 'description', true);
  const pseudoValide      = validerChamp(champPseudo, 'pseudo', false);

  return nomValide && descriptionValide && pseudoValide;
}


/* ─────────────────────────────────────────────────────────────────
   PERSISTANCE — localStorage
   ───────────────────────────────────────────────────────────────── */

function chargerIdees() {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) ?? [];
  } catch {
    return [];
  }
}

function sauvegarderIdees(idees) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(idees));
}


/* ─────────────────────────────────────────────────────────────────
   AFFICHAGE COMPACT DE LA LISTE
   ───────────────────────────────────────────────────────────────── */

/**
 * Crée un élément <li> compact pour une idée.
 * En mode admin, des boutons Modifier / Supprimer sont ajoutés.
 * @param {Object} idee
 * @param {number} index - Position dans le tableau (pour cibler lors de la suppression/modif)
 * @returns {HTMLLIElement}
 */
function creerElementIdee(idee, index) {
  const li = document.createElement('li');
  li.className = 'idees__item';
  li.dataset.index = index;

  // Ligne principale : badge + nom
  const ligneHaut = document.createElement('div');
  ligneHaut.className = 'idees__item-haut';

  const badge = document.createElement('span');
  badge.className = 'idees__item-badge';
  badge.textContent = LABELS_TYPE[idee.type] ?? idee.type;

  const titre = document.createElement('span');
  titre.className = 'idees__item-titre';
  titre.textContent = idee.nom;

  ligneHaut.appendChild(badge);
  ligneHaut.appendChild(titre);

  // Détails (dépliables via <details>)
  const details = document.createElement('details');
  details.className = 'idees__item-details';

  const summary = document.createElement('summary');
  summary.className = 'idees__item-summary';
  summary.textContent = 'Voir plus';

  const corps = document.createElement('div');
  corps.className = 'idees__item-corps';

  const description = document.createElement('p');
  description.className = 'idees__item-description';
  description.textContent = idee.description;

  const dateFormatee = new Date(idee.date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const meta = document.createElement('span');
  meta.className = 'idees__item-meta';
  meta.textContent = idee.pseudo ? `Par ${idee.pseudo} — ${dateFormatee}` : `Anonyme — ${dateFormatee}`;

  corps.appendChild(description);
  corps.appendChild(meta);
  details.appendChild(summary);
  details.appendChild(corps);

  li.appendChild(ligneHaut);
  li.appendChild(details);

  // Boutons admin (masqués si mode admin inactif)
  if (modeAdminActif) {
    const actionsAdmin = document.createElement('div');
    actionsAdmin.className = 'idees__item-actions';

    const btnModif = document.createElement('button');
    btnModif.type = 'button';
    btnModif.className = 'btn-admin btn-admin--modif';
    btnModif.textContent = '✏️ Modifier';
    btnModif.addEventListener('click', () => ouvrirModale(index));

    const btnSuppr = document.createElement('button');
    btnSuppr.type = 'button';
    btnSuppr.className = 'btn-admin btn-admin--suppr';
    btnSuppr.textContent = '🗑️ Supprimer';
    btnSuppr.addEventListener('click', () => supprimerIdee(index));

    actionsAdmin.appendChild(btnModif);
    actionsAdmin.appendChild(btnSuppr);
    li.appendChild(actionsAdmin);
  }

  return li;
}

/**
 * (Re)construit la liste complète des idées dans le DOM.
 */
function afficherToutesLesIdees() {
  const liste   = document.getElementById('idees-liste');
  const wrapper = document.getElementById('idees-liste-wrapper');
  if (!liste || !wrapper) return;

  const idees = chargerIdees();
  liste.textContent = ''; // Vide sans innerHTML

  if (idees.length === 0) {
    wrapper.hidden = true;
    return;
  }

  // Du plus récent au plus ancien
  [...idees].reverse().forEach((idee, i) => {
    // L'index réel dans le tableau original (non inversé)
    const indexReel = idees.length - 1 - i;
    liste.appendChild(creerElementIdee(idee, indexReel));
  });

  wrapper.hidden = false;
}


/* ─────────────────────────────────────────────────────────────────
   ACTIONS ADMIN — Suppression et modification
   ───────────────────────────────────────────────────────────────── */

/**
 * Supprime l'idée à l'index donné.
 * @param {number} index
 */
function supprimerIdee(index) {
  const idees = chargerIdees();
  idees.splice(index, 1);
  sauvegarderIdees(idees);
  afficherToutesLesIdees();
}

/**
 * Ouvre la modale de modification pré-remplie avec les données de l'idée.
 * @param {number} index
 */
function ouvrirModale(index) {
  const idees = chargerIdees();
  const idee = idees[index];
  if (!idee) return;

  document.getElementById('modif-index').value       = index;
  document.getElementById('modif-nom').value         = idee.nom;
  document.getElementById('modif-description').value = idee.description;
  document.getElementById('modif-modal').hidden      = false;
}

/**
 * Sauvegarde les modifications d'une idée.
 */
function sauvegarderModification() {
  const index       = parseInt(document.getElementById('modif-index').value, 10);
  const nouveauNom  = document.getElementById('modif-nom').value.trim();
  const nouvelleDesc = document.getElementById('modif-description').value.trim();

  if (!nouveauNom || !nouvelleDesc) return;

  const idees = chargerIdees();
  if (!idees[index]) return;

  idees[index].nom         = nouveauNom;
  idees[index].description = nouvelleDesc;

  sauvegarderIdees(idees);
  document.getElementById('modif-modal').hidden = true;
  afficherToutesLesIdees();
}


/* ─────────────────────────────────────────────────────────────────
   MODALE D'AUTHENTIFICATION ADMIN
   ───────────────────────────────────────────────────────────────── */

function ouvrirModaleAdmin() {
  document.getElementById('admin-mdp').value         = '';
  document.getElementById('admin-mdp-erreur').hidden = true;
  document.getElementById('admin-modal').hidden      = false;
  document.getElementById('admin-mdp').focus();
}

function fermerModaleAdmin() {
  document.getElementById('admin-modal').hidden = true;
}

/**
 * Vérifie le mot de passe admin par comparaison de hash SHA-256.
 * Le mot de passe en clair n'est jamais stocké ni transmis.
 */
async function verifierAdmin() {
  const mdpSaisi = document.getElementById('admin-mdp').value;
  const hashSaisi = await sha256(mdpSaisi);

  if (hashSaisi === HASH_ADMIN) {
    modeAdminActif = true;
    fermerModaleAdmin();

    // Mettre à jour le bouton admin pour indiquer le mode actif
    const btn = document.getElementById('bouton-admin');
    if (btn) {
      btn.textContent = '🔓 Admin actif';
      btn.classList.add('bouton-admin--actif');
    }

    afficherToutesLesIdees();
  } else {
    document.getElementById('admin-mdp-erreur').hidden = false;
    document.getElementById('admin-mdp').focus();
  }
}

/**
 * Initialise les événements des modales admin et modification.
 */
function initialiserModales() {
  // Bouton d'ouverture du mode admin
  document.getElementById('bouton-admin')?.addEventListener('click', () => {
    if (modeAdminActif) {
      // Désactiver le mode admin
      modeAdminActif = false;
      const btn = document.getElementById('bouton-admin');
      if (btn) { btn.textContent = '🔐 Admin'; btn.classList.remove('bouton-admin--actif'); }
      afficherToutesLesIdees();
    } else {
      ouvrirModaleAdmin();
    }
  });

  // Modale admin
  document.getElementById('admin-valider')?.addEventListener('click', verifierAdmin);
  document.getElementById('admin-annuler')?.addEventListener('click', fermerModaleAdmin);

  // Soumettre avec Entrée dans le champ mot de passe
  document.getElementById('admin-mdp')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifierAdmin();
  });

  // Modale modification
  document.getElementById('modif-valider')?.addEventListener('click', sauvegarderModification);
  document.getElementById('modif-annuler')?.addEventListener('click', () => {
    document.getElementById('modif-modal').hidden = true;
  });

  // Fermer les modales en cliquant sur le fond
  document.querySelectorAll('.admin-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.hidden = true;
    });
  });
}


/* ─────────────────────────────────────────────────────────────────
   SOUMISSION DU FORMULAIRE
   ───────────────────────────────────────────────────────────────── */

function etatChargementBouton(bouton, enChargement) {
  if (enChargement) {
    // On sauvegarde le texte AVANT de l'écraser
    bouton.dataset.texteOriginal = bouton.textContent;
    bouton.textContent = 'Ajout en cours…';
    bouton.disabled = true;
  } else {
    bouton.textContent = bouton.dataset.texteOriginal ?? "Envoyer l'idée 🚀";
    bouton.disabled = false;
  }
}

function traiterSoumission(formulaire) {
  const boutonEnvoi     = formulaire.querySelector('#bouton-envoi');
  const divConfirmation = formulaire.querySelector('#confirmation-envoi');

  if (boutonEnvoi) etatChargementBouton(boutonEnvoi, true);

  const nouvelleIdee = {
    type:        formulaire.querySelector('input[name="type_idee"]:checked')?.value ?? 'lieu',
    nom:         formulaire.querySelector('#champ-nom-lieu').value.trim(),
    description: formulaire.querySelector('#champ-description').value.trim(),
    pseudo:      formulaire.querySelector('#champ-pseudo').value.trim(),
    date:        new Date().toISOString(),
  };

  const idees = chargerIdees();
  idees.push(nouvelleIdee);
  sauvegarderIdees(idees);
  afficherToutesLesIdees();

  formulaire.reset();

  if (divConfirmation) {
    divConfirmation.hidden = false;
    divConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => { divConfirmation.hidden = true; }, 4000);
  }

  if (boutonEnvoi) etatChargementBouton(boutonEnvoi, false);
}


/* ─────────────────────────────────────────────────────────────────
   VALIDATION EN TEMPS RÉEL
   ───────────────────────────────────────────────────────────────── */

function initialiserValidationTempsReel(formulaire) {
  const champsAValider = [
    { element: formulaire.querySelector('#champ-nom-lieu'),    nom: 'nom',         obligatoire: true  },
    { element: formulaire.querySelector('#champ-description'), nom: 'description', obligatoire: true  },
    { element: formulaire.querySelector('#champ-pseudo'),      nom: 'pseudo',      obligatoire: false },
  ];

  champsAValider.forEach(({ element, nom, obligatoire }) => {
    if (!element) return;
    element.addEventListener('blur',  () => { if (element.value.length > 0 || obligatoire) validerChamp(element, nom, obligatoire); });
    element.addEventListener('input', () => { if (element.classList.contains('en-erreur')) effacerErreurChamp(element); });
  });
}


/* ─────────────────────────────────────────────────────────────────
   INITIALISATION
   ───────────────────────────────────────────────────────────────── */

function initialiserFormulaire() {
  const formulaire = document.getElementById('formulaire-idees');
  if (!formulaire) return;

  afficherToutesLesIdees();
  initialiserValidationTempsReel(formulaire);
  initialiserModales();

  formulaire.addEventListener('submit', (e) => {
    e.preventDefault();
    effacerToutesLesErreurs(formulaire);

    if (!validerFormulaire(formulaire)) {
      formulaire.querySelector('.en-erreur')?.focus();
      return;
    }

    traiterSoumission(formulaire);
  });
}

document.addEventListener('DOMContentLoaded', initialiserFormulaire);
