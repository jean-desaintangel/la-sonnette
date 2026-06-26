'use strict';

(async function () {
  /* Le mot de passe n'est pas stocké ici — seulement son empreinte SHA-256.
     Un attaquant qui lit ce fichier ne peut pas retrouver le mot de passe
     original à partir de ce nombre. */
  const EMPREINTE = '154a4225e0bbb76f4cc9cca166741cc6765023038896cc2f0e161757bb40d612';
  const CLE_SESSION = 'ls-ok';

  const verrou    = document.getElementById('verrou');
  const formulaire = document.getElementById('formulaire-verrou');
  const champMdp  = document.getElementById('champ-mdp');
  const erreur    = document.getElementById('erreur-verrou');

  /* Déjà authentifié dans cet onglet → on retire directement le verrou */
  if (sessionStorage.getItem(CLE_SESSION) === '1') {
    deVerrouiller();
    return;
  }

  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    erreur.textContent = '';

    const saisie = champMdp.value;
    const hash = await sha256(saisie);

    if (hash === EMPREINTE) {
      sessionStorage.setItem(CLE_SESSION, '1');
      deVerrouiller();
    } else {
      erreur.textContent = 'Mot de passe incorrect. Réessaie.';
      champMdp.value = '';
      champMdp.focus();
    }
  });

  function deVerrouiller() {
    if (verrou) {
      verrou.style.opacity = '0';
      verrou.style.transition = 'opacity 0.4s ease';
      setTimeout(() => verrou.remove(), 420);
    }
  }

  async function sha256(texte) {
    const donnees = new TextEncoder().encode(texte);
    const tampon  = await crypto.subtle.digest('SHA-256', donnees);
    return Array.from(new Uint8Array(tampon))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
})();
