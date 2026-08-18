'use strict';

(async function () {
  // Configuration Supabase
  const SUPABASE_URL = 'https://qpdsfzhznbftqlmjqbbh.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZHNmemh6bmJmdHFsbWpxYmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjUwMTIsImV4cCI6MjEwMjY0MTAxMn0.DBTtQVKGWq8HsNGYVM90EFod1WgHaHIkS73kVjZgmBw';
  const USER_ID_KEY = 'la-sonnette-user-id';

  // Générer ou récupérer l'UUID utilisateur
  function getOrCreateUserId() {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  }

  const userId = getOrCreateUserId();

  // Initialiser Supabase
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Récupérer les votes de l'utilisateur
  async function getUserVotes() {
    const { data, error } = await supabase
      .from('votes')
      .select('idee')
      .eq('user_id', userId);

    if (error) {
      console.error('Erreur lors de la récupération des votes:', error);
      return [];
    }
    return data.map(v => v.idee);
  }

  // Récupérer le total de votes par idée
  async function getVoteCounts() {
    const { data, error } = await supabase
      .from('votes')
      .select('idee, id')
      .order('idee');

    if (error) {
      console.error('Erreur lors de la récupération des votes:', error);
      return {};
    }

    const counts = {};
    data.forEach(vote => {
      counts[vote.idee] = (counts[vote.idee] || 0) + 1;
    });
    return counts;
  }

  // Ajouter un vote
  async function addVote(idee) {
    const { error } = await supabase
      .from('votes')
      .insert([{ idee, user_id: userId }]);

    if (error) {
      console.error('Erreur lors de l\'ajout du vote:', error);
      return false;
    }
    return true;
  }

  // Retirer un vote
  async function removeVote(idee) {
    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('idee', idee)
      .eq('user_id', userId);

    if (error) {
      console.error('Erreur lors de la suppression du vote:', error);
      return false;
    }
    return true;
  }

  // Mettre à jour l'affichage des votes
  async function updateVoteCounts() {
    const counts = await getVoteCounts();
    let total = 0;

    document.querySelectorAll('.vote-count').forEach(el => {
      const idee = el.getAttribute('data-idee');
      const count = counts[idee] || 0;
      el.textContent = count;
      total += count;
    });

    // Mettre à jour le total
    const totalElement = document.getElementById('total-votes');
    if (totalElement) {
      totalElement.textContent = total;
    }
  }

  // Mettre à jour l'état des boutons
  async function updateButtonStates() {
    const userVotes = await getUserVotes();
    document.querySelectorAll('.contact-direct__item').forEach(item => {
      const idee = item.getAttribute('data-idee');
      const hasVoted = userVotes.includes(idee);
      const minusBtn = item.querySelector('.vote-btn--moins');
      const plusBtn = item.querySelector('.vote-btn--plus');

      minusBtn.disabled = !hasVoted;
      minusBtn.style.opacity = hasVoted ? '1' : '0.5';
      minusBtn.style.cursor = hasVoted ? 'pointer' : 'not-allowed';

      plusBtn.disabled = hasVoted;
      plusBtn.style.opacity = hasVoted ? '0.5' : '1';
      plusBtn.style.cursor = hasVoted ? 'not-allowed' : 'pointer';
    });
  }

  // Charger les données initiales
  async function init() {
    await updateVoteCounts();
    await updateButtonStates();
  }

  // Gestionnaire de clic pour les boutons
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.vote-btn');
    if (!btn) return;

    const item = btn.closest('.contact-direct__item');
    const idee = item.getAttribute('data-idee');
    const isPlus = btn.classList.contains('vote-btn--plus');

    if (isPlus) {
      await addVote(idee);
    } else {
      await removeVote(idee);
    }

    await updateVoteCounts();
    await updateButtonStates();
  });

  // Initialiser au chargement
  init();

  // Mettre à jour les votes toutes les 3 secondes (pour voir les votes des autres)
  setInterval(updateVoteCounts, 3000);
})();
