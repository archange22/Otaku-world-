
document.addEventListener('click', (e) => {
  const reminderBtn = e.target.closest('.btn-reminder');
  if (reminderBtn) {
    e.stopPropagation();
    const airingId = reminderBtn.dataset.airingId;
    const title = reminderBtn.dataset.title;
    const ep = reminderBtn.dataset.ep;
    const time = parseInt(reminderBtn.dataset.time, 10);
    const saved = getSavedReminders();
    if (saved[airingId]) {
      removeReminder(airingId);
      reminderBtn.classList.remove('active');
      reminderBtn.innerHTML = '⏰ Me rappeler';
      toast('Rappel supprimé');
    } else {
      openReminderModal(airingId, title, ep, time);
    }
    return;
  }

  if (e.target.id === 'btnCloseReminderModal' || e.target.id === 'btnCancelReminder') {
    const modal = $('#reminderModal');
    if (modal) modal.hidden = true;
    activeReminderItem = null;
  }

  if (e.target.id === 'btnConfirmReminder' && activeReminderItem) {
    const delay = parseInt($('#reminderDelaySelect')?.value || '60', 10);
    saveReminder(activeReminderItem.airingId, {
      ...activeReminderItem,
      delayMinutes: delay,
      createdAt: Date.now()
    });
    const modal = $('#reminderModal');
    if (modal) modal.hidden = true;
    toast(`🔔 Rappel programmé ${delay >= 60 ? (delay/60) + 'h' : delay + 'min'} avant l\'épisode !`);
    renderFilteredPlanning();
    activeReminderItem = null;
  }
});


// Gestion des rappels d'épisodes et filtres de planning
let activeReminderItem = null;

function getSavedReminders() {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveReminder(airingId, data) {
  const reminders = getSavedReminders();
  reminders[airingId] = data;
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

function removeReminder(airingId) {
  const reminders = getSavedReminders();
  delete reminders[airingId];
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

function openReminderModal(airingId, animeTitle, episodeNum, airingAt) {
  activeReminderItem = { airingId, animeTitle, episodeNum, airingAt };
  const modal = $('#reminderModal');
  const nameEl = $('#reminderAnimeName');
  if (nameEl) nameEl.textContent = `${animeTitle} — Épisode ${episodeNum}`;
  if (modal) modal.hidden = false;
  updateReminderModalPermissionUI();
  
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Listeners pour les filtres du planning
document.addEventListener('change', (e) => {
  if (e.target.id === 'planningSeasonFilter' || e.target.id === 'planningPlatformFilter') {
    renderFilteredPlanning();
  }
});

function renderFilteredPlanning() {
  const grid = $('#planningGrid');
  if (!grid || !window.currentPlanningSchedule) return;
  
  const seasonVal = $('#planningSeasonFilter')?.value || 'ALL';
  const platformVal = $('#planningPlatformFilter')?.value || 'ALL';

  let list = window.currentPlanningSchedule;
  if (seasonVal !== 'ALL') {
    list = list.filter(item => (item.media?.season || '').toUpperCase() === seasonVal);
  }
  if (platformVal !== 'ALL') {
    list = list.filter(item => {
      const sites = (item.media?.externalLinks || []).map(l => (l.site || '').toLowerCase());
      return sites.some(s => s.includes(platformVal.toLowerCase()));
    });
  }

  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Aucun épisode ne correspond aux filtres sélectionnés.</div>';
    return;
  }

  const savedReminders = getSavedReminders();

  grid.innerHTML = list.map(item => {
    const m = item.media;
    const title = m.title.romaji || m.title.english || 'Titre';
    const timeStr = new Date(item.airingAt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const isReminded = !!savedReminders[item.id];

    return `
      <div class="planning-card" data-id="${m.id}" tabindex="0" role="article" aria-label="${title}, Épisode ${item.episode} à ${timeStr}">
        <span class="planning-time">🕒 ${timeStr}</span>
        <div class="planning-poster">
          <img src="${m.coverImage.large || m.coverImage.medium}" alt="${title}" loading="lazy">
        </div>
        <div class="planning-info">
          <h4>${title}</h4>
          <span class="planning-ep">Épisode ${item.episode}</span>
          <button type="button" class="btn-reminder ${isReminded ? 'active' : ''}" data-airing-id="${item.id}" data-title="${title.replace(/"/g, '&quot;')}" data-ep="${item.episode}" data-time="${item.airingAt}" aria-label="Rappel pour ${title}">
            ${isReminded ? '🔔 Rappel actif' : '⏰ Me rappeler'}
          </button>
        </div>
      </div>`;
  }).join('');
}



// === GESTION HORS-LIGNE AVEC HORODATAGE & RÉSOLUTION DE CONFLITS (LWW) ===
const OFFLINE_QUEUE_KEY = 'otaku_offline_queue';
const OFFLINE_FAILED_QUEUE_KEY = 'otaku_failed_sync_queue';
const OFFLINE_CACHE_PREFIX = 'otaku_cache_';
const REMINDERS_KEY = 'otaku_episode_reminders';

function saveToLocalCache(key, data) {
  try {
    localStorage.setItem(OFFLINE_CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('Erreur stockage cache local:', e);
  }
}

function getFromLocalCache(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function queueOfflineAction(action) {
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    // Horodatage précis (Timestamp LWW)
    const actionWithTimestamp = {
      ...action,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    // Si une opération antérieure sur le même item existe déjà dans la file, on la remplace (priorité au plus récent)
    const existingIndex = queue.findIndex(q => q.type === action.type && q.id === action.id);
    if (existingIndex >= 0) {
      queue[existingIndex] = actionWithTimestamp;
    } else {
      queue.push(actionWithTimestamp);
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    updateOfflineBannerUI();
    toast('Action enregistrée hors ligne (horodatage: ' + new Date(actionWithTimestamp.timestamp).toLocaleTimeString() + ')');
  } catch (e) {
    console.error('Erreur mise en file d\'attente hors-ligne:', e);
  }
}

function updateOfflineBannerUI() {
  const banner = document.getElementById('offlineBanner');
  const bannerText = document.getElementById('offlineBannerText');
  const retryBtn = document.getElementById('btnRetrySync');
  const failedCountEl = document.getElementById('syncFailedCount');

  const failedQueue = JSON.parse(localStorage.getItem(OFFLINE_FAILED_QUEUE_KEY) || '[]');
  const normalQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');

  if (!navigator.onLine) {
    if (banner) banner.hidden = false;
    if (bannerText) bannerText.textContent = `📡 Mode hors-ligne — ${normalQueue.length} modification(s) en attente.`;
    if (retryBtn) retryBtn.hidden = true;
  } else if (failedQueue.length > 0) {
    if (banner) banner.hidden = false;
    if (bannerText) bannerText.textContent = `⚠️ ${failedQueue.length} opération(s) n'ont pas pu être synchronisées.`;
    if (retryBtn) retryBtn.hidden = false;
    if (failedCountEl) failedCountEl.textContent = failedQueue.length;
  } else {
    if (banner) banner.hidden = true;
  }
}

// Synchronisation avec résolution de conflits Last-Write-Wins (LWW)
async function syncOfflineQueue() {
  if (!navigator.onLine || !state.user) return;

  const normalQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  const failedQueue = JSON.parse(localStorage.getItem(OFFLINE_FAILED_QUEUE_KEY) || '[]');
  const allQueue = [...normalQueue, ...failedQueue];

  if (!allQueue.length) {
    updateOfflineBannerUI();
    return;
  }

  const remainingFailed = [];
  let syncedCount = 0;

  for (const item of allQueue) {
    try {
      const dbPath = `${item.type}/${state.user.uid}/${item.id}`;
      const targetRef = ref(db, dbPath);

      // Résolution de conflit : Récupération préalable de la valeur serveur
      const serverSnap = await get(targetRef);
      if (serverSnap.exists()) {
        const serverData = serverSnap.val();
        const serverTimestamp = typeof serverData === 'object' && serverData !== null ? (serverData.updatedAt || serverData.timestamp || 0) : 0;
        
        // Si le serveur possède déjà une écriture plus récente que notre action hors ligne, on ignore l'action locale (LWW)
        if (serverTimestamp > item.timestamp) {
          console.info(`[Conflit résolu] Écriture serveur plus récente conservée pour ${dbPath}`);
          continue;
        }
      }

      // Enregistrement de la nouvelle valeur avec son timestamp de mise à jour
      const valueToSave = typeof item.value === 'object' && item.value !== null
        ? { ...item.value, updatedAt: item.timestamp }
        : item.value;

      await set(targetRef, valueToSave);
      syncedCount++;
    } catch (err) {
      console.warn(`Échec de sync pour ${item.type}/${item.id}:`, err);
      item.retryCount = (item.retryCount || 0) + 1;
      item.lastError = err.message || 'Erreur réseau';
      remainingFailed.push(item);
    }
  }

  // Mise à jour des files d'attente
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
  if (remainingFailed.length > 0) {
    localStorage.setItem(OFFLINE_FAILED_QUEUE_KEY, JSON.stringify(remainingFailed));
  } else {
    localStorage.removeItem(OFFLINE_FAILED_QUEUE_KEY);
  }

  updateOfflineBannerUI();

  if (syncedCount > 0) {
    toast(`✅ ${syncedCount} modification(s) synchronisée(s) avec succès !`);
  }
  if (remainingFailed.length > 0) {
    toast(`⚠️ ${remainingFailed.length} opération(s) en attente de reconnexion.`);
  }
}

// Bouton de réessai manuel
document.addEventListener('click', (e) => {
  if (e.target.id === 'btnRetrySync' || e.target.closest('#btnRetrySync')) {
    toast('Nouvelle tentative de synchronisation...');
    syncOfflineQueue();
  }
});

// Notifications et Rappels avec repli In-App garanti
function checkDueReminders() {
  const reminders = getSavedReminders();
  const now = Math.floor(Date.now() / 1000);

  Object.entries(reminders).forEach(([airingId, data]) => {
    const notifyAt = data.airingAt - (data.delayMinutes * 60);
    
    // Si l'heure du rappel est atteinte (dans une fenêtre de 30 minutes passées non encore acquittée)
    if (now >= notifyAt && !data.notified) {
      triggerReminderAlert(airingId, data);
    }
  });
}

function triggerReminderAlert(airingId, data) {
  // Marquer comme notifié
  const reminders = getSavedReminders();
  if (reminders[airingId]) {
    reminders[airingId].notified = true;
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }

  const title = `🔔 Rappel Simulcast : ${data.animeTitle}`;
  const body = `L'épisode ${data.episodeNum} va bientôt sortir (ou est disponible) !`;

  // 1. Essai de notification système si permission accordée
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/manifest.webmanifest',
        badge: '/manifest.webmanifest'
      });
      return;
    } catch (e) {
      console.warn('Erreur notification système, bascule sur alerte in-app:', e);
    }
  }

  // 2. Repli in-app garanti (visible même si les notifications sont refusées ou non supportées)
  showInAppReminderAlert(data.animeTitle, `L'épisode ${data.episodeNum} est prévu dans ${data.delayMinutes >= 60 ? (data.delayMinutes/60) + 'h' : data.delayMinutes + 'min'} !`);
}

function showInAppReminderAlert(title, message) {
  const alertEl = document.getElementById('inAppReminderAlert');
  const titleEl = document.getElementById('inAppReminderTitle');
  const descEl = document.getElementById('inAppReminderDesc');

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = message;
  if (alertEl) {
    alertEl.hidden = false;
    setTimeout(() => {
      alertEl.hidden = true;
    }, 8000);
  }
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'btnCloseInAppAlert') {
    const alertEl = document.getElementById('inAppReminderAlert');
    if (alertEl) alertEl.hidden = true;
  }
});

// Vérification régulière des rappels programmés
setInterval(checkDueReminders, 30000);

// Information utilisateur sur l'état des permissions dans la modale de rappel
function updateReminderModalPermissionUI() {
  const noticeEl = document.getElementById('notifPermissionNotice');
  if (!noticeEl) return;

  if (!('Notification' in window)) {
    noticeEl.className = 'notif-notice notice-fallback';
    noticeEl.innerHTML = 'ℹ️ Les notifications système ne sont pas supportées sur ce navigateur. Une alerte visuelle in-app sera affichée directement dans Otaku-World.';
  } else if (Notification.permission === 'granted') {
    noticeEl.className = 'notif-notice notice-granted';
    noticeEl.innerHTML = '✅ Notifications système autorisées pour cet appareil.';
  } else if (Notification.permission === 'denied') {
    noticeEl.className = 'notif-notice notice-fallback';
    noticeEl.innerHTML = "⚠️ Notifications système bloquées. Otaku-World utilisera automatiquement un bandeau d'alerte in-app pour vous avertir.";
  } else {
    noticeEl.className = 'notif-notice notice-fallback';
    noticeEl.innerHTML = "🔔 Cliquez pour autoriser les notifications système, ou profitez du système d'alerte in-app.";
  }
}


// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
