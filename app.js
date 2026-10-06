import { mangadexAdapter } from './mangadexAdapter.js';
import { app, auth, db, storage } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { ref, get, set, remove, onValue } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

/* ---------- État de l'application (100% MANGA & WEBTOON) ---------- */
const state = {
  currentRoute: 'home',
  mediaId: null,
  user: null,
  library: { favorites: {}, watchlist: {}, history: {} },
  progress: {},
  libTab: 'favorites',
  catalog: {
    page: 1,
    hasNextPage: false,
    loading: false,
    query: '',
    format: 'ALL',
    sort: 'TRENDING_DESC',
    status: 'ALL',
    genre: '',
    items: [],
    type: 'manga'
  },
  heroMedia: [],
  heroIndex: 0,
  heroTimer: null,
  planningDay: 0
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts')?.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// Placeholder SVG KOVA élégant et résilient
function getPosterPlaceholderSvg(title = 'KOVA Manga') {
  const safeTitle = String(title).replace(/[&<>'"\/]/g, '');
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><rect width="100%" height="100%" fill="%230f111d"/><rect x="10" y="10" width="280" height="400" rx="14" fill="%23151829" stroke="%238b5cf6" stroke-opacity="0.3"/><text x="150" y="200" fill="%23a78bfa" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle">KOVA</text><text x="150" y="240" fill="%238c90a4" font-family="sans-serif" font-size="14" text-anchor="middle">${safeTitle.slice(0, 20)}</text></svg>`;
}

window.handleImageError = function(img, fallbackUrl, title) {
  if (!img) return;
  const attempts = parseInt(img.dataset.retryCount || '0', 10);
  if (attempts === 0 && fallbackUrl && fallbackUrl !== img.src) {
    img.dataset.retryCount = '1';
    setTimeout(() => { img.src = fallbackUrl; }, 300);
  } else {
    img.onerror = null;
    img.src = getPosterPlaceholderSvg(title);
  }
};

function setupCarouselAccessibility(scrollEl) {
  if (!scrollEl || scrollEl.dataset.carouselInit) return;
  scrollEl.dataset.carouselInit = 'true';

  scrollEl.addEventListener('keydown', (e) => {
    const cardWidth = scrollEl.querySelector('.card')?.offsetWidth || 180;
    const gap = 14;
    const scrollAmount = cardWidth + gap;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollEl.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollEl.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  });

  scrollEl.querySelectorAll('.card').forEach(card => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.carousel-btn');
  if (!btn) return;
  const targetId = btn.dataset.target;
  const scrollEl = document.getElementById(targetId);
  if (!scrollEl) return;
  const cardWidth = scrollEl.querySelector('.card')?.offsetWidth || 180;
  const step = (cardWidth + 14) * 2;
  const isNext = btn.classList.contains('next');
  scrollEl.scrollBy({ left: isNext ? step : -step, behavior: 'smooth' });
});

function cardHTML(m) {
  const title = (m.title?.romaji || m.title?.display || m.title?.english || 'Manga').replace(/"/g, '&quot;');
  const c = m.coverImage || {};
  const imgLarge = c.large || c.extraLarge || m.coverUrl || '';
  const score = m.averageScore ? (m.averageScore / 10).toFixed(1) : (m.score?.value ? m.score.value : null);
  const fmt = m.format || (m.type ? m.type.toUpperCase() : 'MANGA');
  const sub = [fmt, m.seasonYear || m.year].filter(Boolean).join(' • ');

  return `
    <article class="card" data-id="${m.id}" tabindex="0" role="button" aria-label="${title}, ${fmt}">
      <div class="card-poster">
        <img loading="lazy" decoding="async" src="${imgLarge}" alt="Couverture de ${title}" onerror="handleImageError(this, '', '${title.replace(/'/g, "\'")}')">
        ${score ? `<span class="card-score">★ ${score}</span>` : ''}
        <span class="card-format">${fmt}</span>
      </div>
      <h3 class="card-title">${title}</h3>
      <span class="card-sub">${sub}</span>
    </article>`;
}

function bindCards(container, list = []) {
  if (!container) return;
  container.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const found = (list || []).find(item => String(item.id) === String(id));
      if (found && (found.isAnime || found.mediaType === 'ANIME')) {
        window.openAnimeDetail(found);
      } else {
        window.openMangaDetail(id);
      }
    });
  });
}

/* ==========================================================
   ROUTAGE (Hash Router)
   ========================================================== */
function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const [path, param] = hash.split('/').filter(Boolean);

  let route = 'home';
  if (path === 'catalogue') route = 'catalogue';
  else if (path === 'planning') route = 'planning';
  else if (path === 'library') route = 'library';
  else if (path === 'profile') route = 'profile';
  else if (path === 'manga' && param) {
    window.openMangaDetail(param);
    return;
  }

  state.currentRoute = route;

  $$('.view-page').forEach(v => {
    v.hidden = (v.id !== `view${route.charAt(0).toUpperCase() + route.slice(1)}`);
  });

  $$('#sidebar .side-link, #bottomNav .bn-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  if (route === 'home') loadHome();
  else if (route === 'catalogue') fetchCatalog(true);
  else if (route === 'planning') loadPlanning();
  else if (route === 'library') renderLibrary();
}

/* ==========================================================
   ACCUEIL 100% MANGA, MASCOTTE, RESUME & RECOMMANDATIONS
   ========================================================== */
async function loadHome() {
  const container = $('#feedContainer');
  if (!container) return;

  renderHomeResume();
  renderRecommendations();
  checkFavoriteChapterAlerts();

  // 1. Rendu instantané depuis le cache local (0ms d attente)
  try {
    const cached = JSON.parse(localStorage.getItem('kova_cached_home_data') || 'null');
    if (cached) {
      if (cached.hero && cached.hero.length) {
        state.heroMedia = cached.hero;
        renderHero();
      }
      container.innerHTML = `
        <div class="section-block">
          <div class="section-header">
            <h2 class="section-title">🔥 Manga Populaires</h2>
            <a href="#/catalogue" class="section-badge" style="text-decoration:none;">Tout explorer →</a>
          </div>
          <div class="carousel" id="carouselPopularManga">${cached.popHtml || ''}</div>
        </div>
        <div class="section-block">
          <div class="section-header">
            <h2 class="section-title">🌟 Manhwa & Webtoons Tendances</h2>
            <a href="#/catalogue" class="section-badge" style="text-decoration:none;">Découvrir →</a>
          </div>
          <div class="carousel" id="carouselTrendingManhwa">${cached.manhwaHtml || ''}</div>
        </div>
        <div class="section-block">
          <div class="section-header">
            <h2 class="section-title">⚡ Nouveaux Chapitres & Sorties</h2>
          </div>
          <div class="carousel" id="carouselLatestManga">${cached.latestHtml || ''}</div>
        </div>
      `;
      bindCards($('#carouselPopularManga'), cached.popItems || []);
      bindCards($('#carouselTrendingManhwa'), cached.manhwaItems || []);
      bindCards($('#carouselLatestManga'), cached.latestItems || []);
    }
  } catch (e) {
    console.warn('Cache error:', e);
  }

  // Si aucun cache, injecter les cartes squelettes instantanées
  if (!$('#carouselPopularManga')) {
    const skeletonCards = Array(6).fill('<div class="card card-skeleton" style="height:240px;background:rgba(255,255,255,0.04);border-radius:12px;opacity:0.6;"></div>').join('');
    container.innerHTML = `
      <div class="section-block">
        <div class="section-header"><h2 class="section-title">🔥 Manga Populaires</h2></div>
        <div class="carousel" id="carouselPopularManga">${skeletonCards}</div>
      </div>
      <div class="section-block">
        <div class="section-header"><h2 class="section-title">🌟 Manhwa & Webtoons Tendances</h2></div>
        <div class="carousel" id="carouselTrendingManhwa">${skeletonCards}</div>
      </div>
      <div class="section-block">
        <div class="section-header"><h2 class="section-title">⚡ Nouveaux Chapitres & Sorties</h2></div>
        <div class="carousel" id="carouselLatestManga">${skeletonCards}</div>
      </div>
    `;
  }

  // 2. Requêtes réseau en parallèle (Promise.allSettled)
  try {
    const [popRes, manhwaRes, latestRes] = await Promise.allSettled([
      mangadexAdapter.getCatalogue({ sort: 'followedCount', limit: 12 }),
      mangadexAdapter.getCatalogue({ originalLanguage: 'ko', sort: 'followedCount', limit: 12 }),
      mangadexAdapter.getCatalogue({ sort: 'latest', limit: 12 })
    ]);

    let cachePayload = {};

    if (popRes.status === 'fulfilled' && popRes.value?.items?.length) {
      const popItems = popRes.value.items.map(formatMangaItem);
      const popHtml = popItems.map(cardHTML).join('');
      const el = $('#carouselPopularManga');
      if (el) { el.innerHTML = popHtml; bindCards(el, popItems); }
      state.heroMedia = popItems.slice(0, 5);
      renderHero();
      cachePayload.hero = state.heroMedia;
      cachePayload.popItems = popItems;
      cachePayload.popHtml = popHtml;
    }

    if (manhwaRes.status === 'fulfilled' && manhwaRes.value?.items?.length) {
      const manhwaItems = manhwaRes.value.items.map(formatMangaItem);
      const manhwaHtml = manhwaItems.map(cardHTML).join('');
      const el = $('#carouselTrendingManhwa');
      if (el) { el.innerHTML = manhwaHtml; bindCards(el, manhwaItems); }
      cachePayload.manhwaItems = manhwaItems;
      cachePayload.manhwaHtml = manhwaHtml;
    }

    if (latestRes.status === 'fulfilled' && latestRes.value?.items?.length) {
      const latestItems = latestRes.value.items.map(formatMangaItem);
      const latestHtml = latestItems.map(cardHTML).join('');
      const el = $('#carouselLatestManga');
      if (el) { el.innerHTML = latestHtml; bindCards(el, latestItems); }
      cachePayload.latestItems = latestItems;
      cachePayload.latestHtml = latestHtml;
    }

    if (Object.keys(cachePayload).length > 0) {
      localStorage.setItem('kova_cached_home_data', JSON.stringify(cachePayload));
    }
  } catch (err) {
    console.error('Erreur chargement accueil:', err);
  }
}

function formatMangaItem(m) {
  return {
    id: m.id,
    format: m.type.toUpperCase(),
    title: { romaji: m.title.display, english: m.title.en, native: m.title.original },
    coverImage: { large: m.coverUrl, medium: m.coverUrl, extraLarge: m.coverUrl },
    averageScore: m.score.value ? Math.round(m.score.value * 10) : null,
    seasonYear: m.year,
    isMangaDex: true,
    mangaData: m
  };
}

function renderHero() {
  if (!state.heroMedia.length) return;
  const m = state.heroMedia[state.heroIndex % state.heroMedia.length];
  const title = m.title?.romaji || 'KOVA Manga';
  const img = m.coverImage?.extraLarge || m.coverImage?.large;

  $('#heroBackdrop').style.backgroundImage = `url(${img})`;
  $('#heroContent').innerHTML = `
    <h1 class="hero-title">${title}</h1>
    <div class="hero-meta">
      <span class="score">★ ${m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.8'}</span> •
      <span>${m.format || 'MANGA'}</span> • <span>${m.seasonYear || '2026'}</span>
    </div>
    <div class="hero-actions">
      <button type="button" class="btn-primary" id="btnHeroRead">📖 Lire maintenant</button>
      <button type="button" class="btn-secondary" id="btnHeroDetail">Fiche détaillée</button>
    </div>
  `;

  $('#btnHeroRead')?.addEventListener('click', () => window.openMangaDetail(m.id));
  $('#btnHeroDetail')?.addEventListener('click', () => window.openMangaDetail(m.id));
}

/* ==========================================================
   REPRISE DE LECTURE & RECOMMANDATIONS (AVEC MASQUER / DÉJÀ LU)
   ========================================================== */
function renderHomeResume() {
  const section = $('#homeResumeSection');
  const grid = $('#homeResumeGrid');
  if (!section || !grid) return;

  try {
    const raw = localStorage.getItem('otaku_manga_progress');
    const allProgress = raw ? JSON.parse(raw) : {};
    const entries = Object.entries(allProgress);

    if (!entries.length) {
      section.hidden = true;
      return;
    }

    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const recent = entries.slice(0, 4);

    grid.innerHTML = recent.map(([mId, prog]) => {
      const title = prog.mangaTitle || 'Manga';
      const ch = prog.chapterNumber || '1';
      const page = prog.page || 1;
      const progressPercent = Math.min(100, Math.round((page / 30) * 100));
      return `
        <div class="resume-card" data-manga-id="${mId}" data-chapter-id="${prog.chapterId || ''}" data-page="${page}">
          <div class="resume-poster" style="display:flex;align-items:center;justify-content:center;background:#1e2338;color:#a78bfa;font-size:24px;">📖</div>
          <div class="resume-info">
            <h4 class="resume-title">${title}</h4>
            <div class="resume-sub">Chapitre ${ch} • Page ${page}</div>
            <div class="resume-progress-bg">
              <div class="resume-progress-bar" style="width: ${progressPercent}%;"></div>
            </div>
            <span class="resume-btn">▶ Reprendre</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.resume-card').forEach(card => {
      card.addEventListener('click', () => {
        const mId = card.dataset.mangaId;
        const chId = card.dataset.chapterId;
        const p = parseInt(card.dataset.page, 10) || 1;
        if (mId && chId) openMangaReader(mId, chId, p);
        else if (mId) window.openMangaDetail(mId);
      });
    });

    section.hidden = false;
  } catch (e) {
    section.hidden = true;
  }
}

async function renderRecommendations() {
  const section = $('#homeRecommendationsSection');
  const grid = $('#homeRecommendationsGrid');
  if (!section || !grid) return;

  const hiddenIds = JSON.parse(localStorage.getItem('kova_hidden_mangas') || '[]');

  try {
    const res = await mangadexAdapter.getCatalogue({ sort: 'rating', limit: 10 });
    const items = (res.items || []).filter(m => !hiddenIds.includes(m.id)).slice(0, 4);

    if (!items.length) {
      section.hidden = true;
      return;
    }

    grid.innerHTML = items.map(m => `
      <div class="rec-card" data-id="${m.id}">
        <img class="rec-poster" src="${m.coverUrl}" alt="${m.title.display}">
        <div class="rec-info">
          <h4 class="rec-title">${m.title.display}</h4>
          <span class="rec-genres">${(m.genres || []).slice(0, 2).map(g => g.name).join(' • ') || 'Manga'}</span>
          <div class="rec-actions">
            <button type="button" class="btn-rec-action primary btn-rec-read">📖 Lire</button>
            <button type="button" class="btn-rec-action btn-rec-done" title="Marquer comme déjà lu">👁️ Déjà lu</button>
            <button type="button" class="btn-rec-action btn-rec-hide" title="Masquer de mes recommandations">🚫 Masquer</button>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.rec-card').forEach(card => {
      const id = card.dataset.id;
      const mItem = items.find(x => x.id === id);

      card.querySelector('.btn-rec-read')?.addEventListener('click', () => window.openMangaDetail(id));

      card.querySelector('.btn-rec-done')?.addEventListener('click', () => {
        saveMangaProgress(id, {
          chapterId: 'completed',
          chapterNumber: 'Fin',
          page: 1,
          mangaTitle: mItem?.title?.display || 'Manga'
        });
        toast('Ajouté à votre historique de lecture !');
        card.remove();
        if (!grid.children.length) section.hidden = true;
      });

      card.querySelector('.btn-rec-hide')?.addEventListener('click', () => {
        const cur = JSON.parse(localStorage.getItem('kova_hidden_mangas') || '[]');
        cur.push(id);
        localStorage.setItem('kova_hidden_mangas', JSON.stringify(cur));
        toast('Titre masqué des recommandations.');
        card.remove();
        if (!grid.children.length) section.hidden = true;
      });
    });

    section.hidden = false;
  } catch (err) {
    section.hidden = true;
  }
}

/* ==========================================================
   ALERTES NOUVEAUX CHAPITRES DES FAVORIS
   ========================================================== */
async function checkFavoriteChapterAlerts() {
  const alertsEnabled = localStorage.getItem('kova_chapter_alerts') !== 'false';
  if (!alertsEnabled) return;

  const rawFavs = localStorage.getItem('otaku_manga_favorites');
  const favs = rawFavs ? JSON.parse(rawFavs) : [];
  if (!favs.length) return;

  try {
    const firstFav = favs[0];
    const feed = await mangadexAdapter.getFeed(firstFav.id, { limit: 1 });
    const latestCh = feed.chapters?.[0];
    if (latestCh) {
      const banner = $('#inAppReminderAlert');
      const titleEl = $('#inAppReminderTitle');
      const descEl = $('#inAppReminderDesc');
      if (banner && titleEl && descEl) {
        titleEl.textContent = `Nouveau chapitre pour ${firstFav.title} !`;
        descEl.textContent = `${latestCh.title || 'Chapitre ' + latestCh.chapter} est disponible en lecture.`;
        banner.hidden = false;
        $('#btnCloseInAppAlert')?.addEventListener('click', () => { banner.hidden = true; });
      }
    }
  } catch (e) {
    console.warn('Vérification des alertes chapitres:', e);
  }
}

/* ==========================================================
   CATALOGUE 100% MANGA AVEC FILTRES, RECHERCHE & PAGINATION
   ========================================================== */

/* ==========================================================
   ANILIST GRAPHQL ADAPTER POUR LES ANIMES
   ========================================================== */
async function fetchAniListCatalog({ page = 1, perPage = 24, search = '', sort = 'TRENDING_DESC', status = null } = {}) {
  const query = `query($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $status: MediaStatus) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage total }
      media(type: ANIME, search: $search, sort: $sort, status: $status, isAdult: false) {
        id
        title { romaji english native }
        coverImage { large extraLarge }
        bannerImage
        format
        episodes
        duration
        status
        seasonYear
        averageScore
        description
        genres
        trailer { id site }
      }
    }
  }`;

  const variables = { page, perPage };
  if (search && search.trim()) {
    variables.search = search.trim();
    variables.sort = ['SEARCH_MATCH'];
  } else {
    variables.sort = [sort];
  }
  if (status && status !== 'ALL') {
    variables.status = status;
  }

  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) throw new Error('Erreur AniList: ' + res.status);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'Erreur AniList');

  const p = json.data.Page;
  return {
    items: p.media.map(m => ({
      id: m.id,
      mediaType: 'ANIME',
      format: m.format || 'ANIME',
      title: { romaji: m.title.romaji || m.title.english, english: m.title.english, native: m.title.native },
      coverImage: { large: m.coverImage.large, extraLarge: m.coverImage.extraLarge || m.coverImage.large },
      bannerImage: m.bannerImage,
      averageScore: m.averageScore,
      seasonYear: m.seasonYear,
      episodes: m.episodes,
      duration: m.duration,
      status: m.status,
      description: m.description,
      genres: m.genres || [],
      trailer: m.trailer,
      isAnime: true
    })),
    total: p.pageInfo.total,
    hasMore: p.pageInfo.hasNextPage
  };
}

window.openAnimeDetail = function(anime) {
  const detailView = $('#viewDetail');
  if (!detailView) return;
  window.location.hash = `#/anime/${anime.id}`;

  const genresHtml = (anime.genres || []).map(g => `<span class="chip active">${g}</span>`).join('');
  const cleanDesc = (anime.description || 'Aucune description disponible.').replace(/<[^>]*>?/gm, '');

  let trailerHtml = '';
  if (anime.trailer && anime.trailer.site === 'youtube') {
    trailerHtml = `
      <div style="margin-top:24px;">
        <h3 style="color:#fff;margin-bottom:12px;">Bande-annonce officielle</h3>
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;">
          <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" src="https://www.youtube.com/embed/${anime.trailer.id}" allowfullscreen></iframe>
        </div>
      </div>
    `;
  }

  detailView.innerHTML = `
    <div class="detail-container" style="max-width:960px;margin:0 auto;padding:20px 16px;">
      <button type="button" class="btn-secondary" onclick="window.history.back()" style="margin-bottom:16px;">← Retour</button>
      <div class="detail-hero" style="display:flex;gap:24px;flex-wrap:wrap;">
        <img src="${anime.coverImage?.extraLarge || anime.coverImage?.large}" alt="${anime.title.romaji}" style="width:200px;border-radius:12px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        <div style="flex:1;min-width:260px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span class="card-format" style="position:static;padding:4px 8px;">${anime.format || 'ANIME'}</span>
            ${anime.averageScore ? `<span class="card-score" style="position:static;">★ ${(anime.averageScore / 10).toFixed(1)}</span>` : ''}
            <span style="color:#888;font-size:0.85rem;">Statut: ${anime.status || 'N/A'}</span>
            ${anime.episodes ? `<span style="color:#888;font-size:0.85rem;">• ${anime.episodes} épisodes</span>` : ''}
          </div>
          <h1 style="color:#fff;font-size:1.8rem;margin-bottom:12px;">${anime.title.romaji}</h1>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${genresHtml}</div>
          <p style="color:#ccc;line-height:1.6;font-size:0.95rem;">${cleanDesc}</p>
        </div>
      </div>
      ${trailerHtml}
    </div>
  `;

  detailView.hidden = false;
  $('.view-page').forEach(v => { if (v.id !== 'viewDetail') v.hidden = true; });
};

function initCatalogEvents() {
  $('#catTabManga')?.addEventListener('click', () => {
    $('#catTabManga').classList.add('active');
    $('#catTabAnime')?.classList.remove('active');
    state.catalog.type = 'manga';
    state.catalog.page = 1;
    fetchCatalog(true);
  });

  $('#catTabAnime')?.addEventListener('click', () => {
    $('#catTabAnime').classList.add('active');
    $('#catTabManga')?.classList.remove('active');
    state.catalog.type = 'anime';
    state.catalog.page = 1;
    fetchCatalog(true);
  });
  const searchInput = $('#catSearchInput');
  const clearBtn = $('#catSearchClear');

  let debounceTimer;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const q = e.target.value.trim();
    if (clearBtn) clearBtn.hidden = !q;
    debounceTimer = setTimeout(() => {
      state.catalog.query = q;
      state.catalog.page = 1;
      fetchCatalog(true);
    }, 350);
  });

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.hidden = true;
    state.catalog.query = '';
    state.catalog.page = 1;
    fetchCatalog(true);
  });

  $('#filterFormat')?.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#filterFormat .chip.active')?.classList.remove('active');
      btn.classList.add('active');
      state.catalog.format = btn.dataset.val;
      state.catalog.page = 1;
      fetchCatalog(true);
    });
  });

  $('#filterStatus')?.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#filterStatus .chip.active')?.classList.remove('active');
      btn.classList.add('active');
      state.catalog.status = btn.dataset.status;
      state.catalog.page = 1;
      fetchCatalog(true);
    });
  });

  $('#filterSort')?.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#filterSort .chip.active')?.classList.remove('active');
      btn.classList.add('active');
      state.catalog.sort = btn.dataset.val;
      state.catalog.page = 1;
      fetchCatalog(true);
    });
  });

  $('#filterGenres')?.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#filterGenres .chip.active')?.classList.remove('active');
      btn.classList.add('active');
      state.catalog.genre = btn.dataset.genre || '';
      state.catalog.page = 1;
      fetchCatalog(true);
    });
  });

  $('#btnCatalogPrevPage')?.addEventListener('click', () => {
    if (state.catalog.page > 1) {
      state.catalog.page -= 1;
      fetchCatalog(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  $('#btnCatalogNextPage')?.addEventListener('click', () => {
    state.catalog.page += 1;
    fetchCatalog(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#btnLoadMore')?.addEventListener('click', () => {
    state.catalog.page += 1;
    fetchCatalog(false);
  });
}

async function fetchCatalog(reset = false) {
  if (state.catalog.loading) return;
  state.catalog.loading = true;

  if (reset) {
    $('#catalogGrid').innerHTML = '';
    $('#catalogEmpty').hidden = true;
  }

  $('#catalogLoading').hidden = false;
  $('#catalogMoreWrap').hidden = true;

  const pageInd = $('#catalogPageIndicator');
  if (pageInd) pageInd.textContent = `Page ${state.catalog.page}`;
  const btnPrev = $('#btnCatalogPrevPage');
  if (btnPrev) btnPrev.disabled = state.catalog.page <= 1;

  try {
        let mangaItems = [];
    if (state.catalog.type === 'anime') {
      const animeRes = await fetchAniListCatalog({
        page: state.catalog.page,
        perPage: 24,
        search: state.catalog.query,
        sort: state.catalog.sort === 'SCORE_DESC' ? 'SCORE_DESC' : 'TRENDING_DESC',
        status: state.catalog.status === 'RELEASING' ? 'RELEASING' : (state.catalog.status === 'FINISHED' ? 'FINISHED' : null)
      });
      mangaItems = animeRes.items;
      state.catalog.hasNextPage = animeRes.hasMore;
      $('#catalogCount').textContent = `${animeRes.total ? animeRes.total.toLocaleString('fr-FR') : mangaItems.length} animes trouvés`;
    } else {
      let mdSort = 'followedCount';
      let mdSortOrder = 'desc';
      if (state.catalog.sort === 'SCORE_DESC') mdSort = 'rating';
      else if (state.catalog.sort === 'START_DATE_DESC') mdSort = 'latest';
      else if (state.catalog.sort === 'TITLE_ROMAJI') { mdSort = 'title'; mdSortOrder = 'asc'; }

      let langFilter = null;
      const fmt = state.catalog.format || 'ALL';
      if (fmt === 'MANGA') langFilter = 'ja';
      else if (fmt === 'MANHWA') langFilter = 'ko';
      else if (fmt === 'MANHUA') langFilter = 'zh';

      let statusParam = [];
      if (state.catalog.status === 'RELEASING') statusParam = ['ongoing'];
      else if (state.catalog.status === 'FINISHED') statusParam = ['completed'];

      const mangaRes = await mangadexAdapter.getCatalogue({
        query: state.catalog.query || '',
        sort: mdSort,
        sortOrder: mdSortOrder,
        originalLanguage: langFilter,
        status: statusParam,
        page: state.catalog.page,
        limit: 24
      });

      mangaItems = (mangaRes.items || []).map(formatMangaItem);
      state.catalog.hasNextPage = mangaRes.hasMore;
      $('#catalogCount').textContent = `${mangaRes.total ? mangaRes.total.toLocaleString('fr-FR') : mangaItems.length} mangas trouvés`;
    }

    if (reset) {
      state.catalog.items = mangaItems;
      $('#catalogGrid').innerHTML = mangaItems.map(cardHTML).join('');
    } else {
      state.catalog.items = [...state.catalog.items, ...mangaItems];
      const div = document.createElement('div');
      div.innerHTML = mangaItems.map(cardHTML).join('');
      while (div.firstChild) $('#catalogGrid').appendChild(div.firstChild);
    }

    bindCards($('#catalogGrid'), state.catalog.items);

    if (!state.catalog.items.length) {
      $('#catalogEmpty').hidden = false;
    } else if (mangaRes.hasMore) {
      $('#catalogMoreWrap').hidden = false;
    }
  } catch (err) {
    if (reset) {
      $('#catalogGrid').innerHTML = '';
      $('#catalogEmpty').hidden = false;
      $('#catalogEmpty').querySelector('p').textContent = 'Erreur lors du chargement des mangas: ' + err.message;
    }
  } finally {
    state.catalog.loading = false;
    $('#catalogLoading').hidden = true;
  }
}

/* ==========================================================
   PLANNING PARUTIONS MANGA & WEBTOON
   ========================================================== */
async function loadPlanning() {
  const grid = $('#planningGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="catalog-loading"><div class="spinner"></div><p>Chargement des parutions...</p></div>';

  try {
    const res = await mangadexAdapter.getCatalogue({ sort: 'latest', limit: 20 });
    const items = (res.items || []).map(formatMangaItem);
    grid.innerHTML = items.map(cardHTML).join('');
    bindCards(grid, items);
  } catch (err) {
    grid.innerHTML = '<p style="padding:20px;color:#888;">Impossible de charger le planning.</p>';
  }
}

/* ==========================================================
   FICHE DÉTAILLÉE MANGA UNIFIÉE
   ========================================================== */
window.openMangaDetail = async function(mangaId) {
  const detailView = $('#viewDetail');
  if (!detailView) return;
  window.location.hash = `#/manga/${mangaId}`;

  detailView.innerHTML = '<div class="catalog-loading" style="padding:100px 0;"><div class="spinner"></div><p style="color:#aaa;margin-top:10px;">Chargement de la fiche manga...</p></div>';
  detailView.hidden = false;
  $$('.view-page').forEach(v => { if (v.id !== 'viewDetail') v.hidden = true; });

  try {
    const manga = await mangadexAdapter.getMangaDetails(mangaId);
    const feed = await mangadexAdapter.getFeed(mangaId, { limit: 100 });
    currentMangaState.manga = manga;
    currentMangaState.chapters = feed.chapters || [];

    const progress = getMangaProgress(mangaId);
    const genresHtml = (manga.genres || []).map(g => `<span class="chip active">${g.name}</span>`).join('');

    let resumeBtnHtml = '';
    if (progress && progress.chapterId) {
      resumeBtnHtml = `<button type="button" class="btn-primary" id="btnResumeManga" style="background:var(--accent);margin-right:10px;">▶ Reprendre Ch. ${progress.chapterNumber || ''} (p. ${progress.page || 1})</button>`;
    }
    const firstChapterId = currentMangaState.chapters[currentMangaState.chapters.length - 1]?.id || currentMangaState.chapters[0]?.id;

    const chaptersHtml = currentMangaState.chapters.map((ch, idx) => {
      const isRead = progress && progress.chapterId === ch.id;
      return `
        <div class="manga-ch-item ${isRead ? 'read' : ''}" data-idx="${idx}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:8px;cursor:pointer;">
          <div>
            <strong style="color:#fff;font-size:0.95rem;">${ch.title || 'Chapitre ' + ch.chapter}</strong>
            <span style="display:block;font-size:0.75rem;color:#888;">Langue: ${ch.language.toUpperCase()} ${ch.isFallbackLanguage ? '(Repli EN)' : ''}</span>
          </div>
          <button type="button" class="btn-primary btn-sm" style="padding:6px 12px;font-size:0.8rem;">${isRead ? 'Reprendre' : 'Lire'}</button>
        </div>
      `;
    }).join('') || '<p style="color:#888;">Aucun chapitre disponible pour le moment.</p>';

    detailView.innerHTML = `
      <div class="detail-container" style="max-width:960px;margin:0 auto;padding:20px 16px;">
        <button type="button" class="btn-secondary" onclick="window.history.back()" style="margin-bottom:16px;">← Retour</button>
        <div class="detail-hero" style="display:flex;gap:24px;flex-wrap:wrap;">
          <img src="${manga.coverUrl}" alt="${manga.title.display}" style="width:200px;border-radius:12px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          <div style="flex:1;min-width:260px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span class="card-format" style="position:static;padding:4px 8px;">${manga.type.toUpperCase()}</span>
              ${manga.score?.value ? `<span class="card-score" style="position:static;">★ ${manga.score.value}</span>` : ''}
              <span style="color:#888;font-size:0.85rem;">Statut: ${manga.status}</span>
            </div>
            <h1 style="color:#fff;font-size:1.8rem;margin-bottom:12px;">${manga.title.display}</h1>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${genresHtml}</div>
            <div style="margin-bottom:20px;">
              ${resumeBtnHtml}
              ${firstChapterId ? `<button type="button" class="btn-primary" id="btnStartManga">📖 Commencer à lire</button>` : ''}
              <button type="button" class="btn-secondary" id="btnDetailFav" style="margin-left:10px;">♥ Favori</button>
            </div>
            <p style="color:#ccc;line-height:1.6;font-size:0.95rem;">${manga.synopsis.text}</p>
          </div>
        </div>

        <div style="margin-top:36px;">
          <h2 style="color:#fff;font-size:1.3rem;margin-bottom:16px;">Chapitres disponibles (${currentMangaState.chapters.length})</h2>
          <div class="manga-chapters-list" id="mangaChaptersList">${chaptersHtml}</div>
        </div>
      </div>
    `;

    $('#btnResumeManga')?.addEventListener('click', () => {
      if (progress && progress.chapterId) openMangaReader(manga.id, progress.chapterId, progress.page || 1);
    });

    $('#btnStartManga')?.addEventListener('click', () => {
      if (firstChapterId) openMangaReader(manga.id, firstChapterId, 1);
    });

    $('#btnDetailFav')?.addEventListener('click', () => {
      const favs = JSON.parse(localStorage.getItem('otaku_manga_favorites') || '[]');
      const exists = favs.some(f => f.id === manga.id);
      if (!exists) {
        favs.push({ id: manga.id, title: manga.title.display, coverUrl: manga.coverUrl });
        localStorage.setItem('otaku_manga_favorites', JSON.stringify(favs));
        toast('Ajouté aux favoris KOVA !');
      } else {
        toast('Déjà dans vos favoris.');
      }
    });

    $$('#mangaChaptersList .manga-ch-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const ch = currentMangaState.chapters[idx];
        if (ch) openMangaReader(manga.id, ch.id, 1);
      });
    });

  } catch (err) {
    detailView.innerHTML = `<div class="catalog-loading"><p style="color:#ff6b6b;">Erreur: ${err.message}</p><button class="btn-primary" onclick="window.history.back()" style="margin-top:14px;">Retour</button></div>`;
  }
};

/* ==========================================================
   LECTEUR MANGA FIABILISÉ AVEC ACCESSIBILITÉ & PLEIN ÉCRAN
   ========================================================= */
let currentMangaState = {
  manga: null,
  chapters: [],
  currentChapterIndex: -1,
  currentPage: 1,
  totalPages: 1,
  dataSaver: false,
  contrast: 'normal',
  size: 'fit'
};

const MANGA_PROGRESS_KEY = 'otaku_manga_progress';

function getMangaProgress(mangaId) {
  try {
    const all = JSON.parse(localStorage.getItem(MANGA_PROGRESS_KEY) || '{}');
    return all[mangaId] || null;
  } catch (e) {
    return null;
  }
}

function saveMangaProgress(mangaId, data) {
  try {
    const all = JSON.parse(localStorage.getItem(MANGA_PROGRESS_KEY) || '{}');
    all[mangaId] = { ...data, updatedAt: Date.now() };
    localStorage.setItem(MANGA_PROGRESS_KEY, JSON.stringify(all));

    if (window.currentUser && window.db) {
      try {
        const progRef = window.db.ref(`progress/${window.currentUser.uid}/${mangaId}`);
        progRef.update({
          mediaType: 'manga',
          chapterId: data.chapterId,
          chapterNumber: data.chapterNumber,
          page: data.page,
          mangaTitle: data.mangaTitle,
          updatedAt: Date.now()
        });
      } catch (err) {}
    }
  } catch (e) {}
}

window.openMangaReader = async function(mangaId, chapterId, initialPage = 1) {
  const readerView = $('#viewMangaReader');
  if (!readerView) return;

  readerView.hidden = false;
  $('#readerLoading').hidden = false;
  $('#readerLoading').style.display = 'flex';
  $('#readerPagesVertical').innerHTML = '';

  const manga = currentMangaState.manga;
  $('#readerMangaTitle').textContent = manga ? manga.title.display : 'Manga';

  const chIndex = currentMangaState.chapters.findIndex(c => c.id === chapterId);
  currentMangaState.currentChapterIndex = chIndex;
  const currentChapter = chIndex >= 0 ? currentMangaState.chapters[chIndex] : null;

  $('#readerChapterTitle').textContent = currentChapter ? (currentChapter.title || `Chapitre ${currentChapter.chapter}`) : 'Chapitre';

  // Remplir sélecteur de chapitres
  const sel = $('#readerChapterSelect');
  if (sel) {
    sel.innerHTML = currentMangaState.chapters.map((c) => `
      <option value="${c.id}" ${c.id === chapterId ? 'selected' : ''}>
        ${c.title || 'Chapitre ' + c.chapter} (${c.language.toUpperCase()})
      </option>
    `).join('');
  }

  const btnPrev = $('#btnPrevChapter');
  const btnNext = $('#btnNextChapter');
  if (btnPrev) btnPrev.disabled = chIndex >= currentMangaState.chapters.length - 1;
  if (btnNext) btnNext.disabled = chIndex <= 0;

  try {
    const pagesData = await mangadexAdapter.getChapterPages(chapterId, { dataSaver: currentMangaState.dataSaver });
    $('#readerLoading').hidden = true;
    $('#readerLoading').style.display = 'none';
    currentMangaState.totalPages = pagesData.total;
    $('#readerPageCounter').textContent = `Page ${initialPage} / ${pagesData.total}`;

    const pagesFrag = document.createDocumentFragment();
    pagesData.pages.forEach((p, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'reader-page-wrap';
      wrap.dataset.page = idx + 1;

      const loader = document.createElement('div');
      loader.className = 'reader-page-loading';
      loader.innerHTML = '<div class="spinner"></div><p>Page ' + (idx + 1) + '...</p>';
      wrap.appendChild(loader);

      const img = document.createElement('img');
      img.className = 'reader-page-img';
      img.dataset.page = idx + 1;
      img.alt = `Planche manga page ${idx + 1}`;
      img.loading = idx < 3 ? 'eager' : 'lazy';
      img.src = p.url;

      img.addEventListener('load', () => {
        loader.remove();
      });

      wrap.appendChild(img);
      pagesFrag.appendChild(wrap);
    });

    $('#readerPagesVertical').appendChild(pagesFrag);

    // Reprise exacte de la page au défilement
    if (initialPage > 1) {
      setTimeout(() => {
        const targetImg = $(`#readerPagesVertical img[data-page="${initialPage}"]`);
        if (targetImg) targetImg.scrollIntoView({ behavior: 'smooth' });
      }, 250);
    }

    const container = $('#readerContainer');
    let scrollTimer = null;
    container.onscroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const imgs = $$('#readerPagesVertical img');
        const containerTop = container.getBoundingClientRect().top;
        for (const img of imgs) {
          const rect = img.getBoundingClientRect();
          if (rect.bottom >= containerTop + 80) {
            const pageNum = parseInt(img.dataset.page, 10) || 1;
            $('#readerPageCounter').textContent = `Page ${pageNum} / ${pagesData.total}`;
            saveMangaProgress(mangaId, {
              chapterId,
              chapterNumber: currentChapter?.chapter || '1',
              page: pageNum,
              mangaTitle: manga?.title?.display || 'Manga'
            });
            break;
          }
        }
      }, 100);
    };

    addKovaXp(50);
    saveMangaProgress(mangaId, {
      chapterId,
      chapterNumber: currentChapter?.chapter || '1',
      page: initialPage,
      mangaTitle: manga?.title?.display || 'Manga'
    });

  } catch (err) {
    $('#readerLoading').innerHTML = `<p style="color:#ff6b6b;">Impossible de charger les pages de ce chapitre: ${err.message}</p>`;
  }
};

/* ==========================================================
   CONTRÔLES DU LECTEUR & ACCESSIBILITÉ CLAVIER
   ========================================================== */
function initReaderControls() {
  $('#btnCloseReader')?.addEventListener('click', () => {
    const readerView = $('#viewMangaReader');
    if (readerView) readerView.hidden = true;
  });

  $('#btnToggleDataSaver')?.addEventListener('click', () => {
    currentMangaState.dataSaver = !currentMangaState.dataSaver;
    const ind = $('#dataSaverIndicator');
    const chip = $('#btnToggleDataSaver');
    if (currentMangaState.dataSaver) {
      chip.classList.add('active-saver');
      if (ind) ind.textContent = '📉 Mode Éco Actif';
    } else {
      chip.classList.remove('active-saver');
      if (ind) ind.textContent = '⚡ Haute Qualité';
    }
    const ch = currentMangaState.chapters[currentMangaState.currentChapterIndex];
    if (ch && currentMangaState.manga) openMangaReader(currentMangaState.manga.id, ch.id, 1);
  });

  // Plein écran
  $('#btnToggleFullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  });

  // Accessibilité : Contraste
  $('#readerContrastSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const cont = $('#readerPagesVertical');
    if (!cont) return;
    cont.classList.remove('contrast-high-contrast', 'contrast-sepia', 'contrast-night');
    if (val !== 'normal') cont.classList.add(`contrast-${val}`);
  });

  // Accessibilité : Taille d'affichage
  $('#readerSizeSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const cont = $('#readerPagesVertical');
    if (!cont) return;
    cont.classList.remove('size-fit', 'size-medium', 'size-large');
    cont.classList.add(`size-${val}`);
  });

  // Navigation chapitres
  $('#btnPrevChapter')?.addEventListener('click', () => {
    if (currentMangaState.currentChapterIndex < currentMangaState.chapters.length - 1) {
      const prevCh = currentMangaState.chapters[currentMangaState.currentChapterIndex + 1];
      if (prevCh && currentMangaState.manga) openMangaReader(currentMangaState.manga.id, prevCh.id, 1);
    }
  });

  $('#btnNextChapter')?.addEventListener('click', () => {
    if (currentMangaState.currentChapterIndex > 0) {
      const nextCh = currentMangaState.chapters[currentMangaState.currentChapterIndex - 1];
      if (nextCh && currentMangaState.manga) openMangaReader(currentMangaState.manga.id, nextCh.id, 1);
    }
  });

  $('#readerChapterSelect')?.addEventListener('change', (e) => {
    const chId = e.target.value;
    if (chId && currentMangaState.manga) openMangaReader(currentMangaState.manga.id, chId, 1);
  });

  // Navigation complète au clavier
  window.addEventListener('keydown', (e) => {
    const readerView = $('#viewMangaReader');
    if (!readerView || readerView.hidden) return;

    const container = $('#readerContainer');
    if (!container) return;

    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      container.scrollBy({ top: 350, behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      container.scrollBy({ top: -350, behavior: 'smooth' });
    } else if (e.key.toLowerCase() === 'f') {
      $('#btnToggleFullscreen')?.click();
    } else if (e.key === 'ArrowLeft') {
      $('#btnPrevChapter')?.click();
    } else if (e.key === 'ArrowRight') {
      $('#btnNextChapter')?.click();
    }
  });
}

/* ==========================================================
   AUTHENTIFICATION FIREBASE SÉCURISÉE & DÉBLOQUÉE
   ========================================================== */
function initAuth() {
  const btnGoogle = $('#btnGoogleAuth');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      const errEl = $('#authError');
      errEl.hidden = true;
      btnGoogle.disabled = true;
      btnGoogle.innerHTML = '<span>Connexion Google en cours...</span>';

      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        $('#authModal').hidden = true;
        toast('Connexion Google réussie !');
      } catch (err) {
        console.warn('Erreur Google popup, tentative redirect:', err);
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
          try {
            const provider = new GoogleAuthProvider();
            await signInWithRedirect(auth, provider);
            return;
          } catch (rErr) {
            errEl.hidden = false;
            errEl.textContent = 'Erreur connexion: ' + rErr.message;
          }
        } else {
          errEl.hidden = false;
          errEl.textContent = err.message;
        }
      } finally {
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"/><path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"/></svg><span>Continuer avec Google</span>';
      }
    });
  }

  let authIsLogin = true;
  $('#btnAuthToggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    authIsLogin = !authIsLogin;
    $('#authTitle').textContent = authIsLogin ? 'Connexion' : 'Créer un compte';
    $('#authSubmit').textContent = authIsLogin ? 'Se connecter' : 'Créer le compte';
    $('#authSwitchPrompt').textContent = authIsLogin ? "Vous n'avez pas de compte ?" : 'Déjà un compte ?';
    $('#btnAuthToggle').textContent = authIsLogin ? 'Créer un compte' : 'Se connecter';
  });

  $('#authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#authEmail').value.trim();
    const pass = $('#authPass').value;
    const errEl = $('#authError');
    const submitBtn = $('#authSubmit');
    errEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Chargement...';

    try {
      if (authIsLogin) {
        await signInWithEmailAndPassword(auth, email, pass);
        toast('Connexion réussie !');
      } else {
        await createUserWithEmailAndPassword(auth, email, pass);
        toast('Compte créé avec succès !');
      }
      $('#authModal').hidden = true;
    } catch (err) {
      errEl.hidden = false;
      errEl.textContent = err.code === 'auth/invalid-credential' ? 'Email ou mot de passe incorrect.'
        : err.code === 'auth/email-already-in-use' ? 'Cette adresse email est déjà utilisée.'
        : err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = authIsLogin ? 'Se connecter' : 'Créer le compte';
    }
  });

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    window.currentUser = user;
    if (user) {
      const name = user.displayName || user.email.split('@')[0];
      $('#profileUsername').textContent = name;
      $('#profileEmail').textContent = user.email;
      $('#profileRoleBadge').textContent = 'Membre KOVA';
      $('#btnOpenAuth').textContent = 'Se déconnecter';
    } else {
      $('#profileUsername').textContent = 'Invité';
      $('#profileEmail').textContent = 'Non connecté';
      $('#profileRoleBadge').textContent = 'Visiteur';
      $('#btnOpenAuth').textContent = 'Se connecter / S\'inscrire';
    }
    updateProfileKovaUI();
  });
}

function initNavigation() {
  $('#btnDrawerOpen')?.addEventListener('click', () => { $('#drawerOverlay').hidden = false; });
  $('#btnDrawerClose')?.addEventListener('click', () => { $('#drawerOverlay').hidden = true; });
  $('#drawerOverlay')?.addEventListener('click', (e) => {
    if (e.target === $('#drawerOverlay')) $('#drawerOverlay').hidden = true;
  });

  $('#btnUserMenu')?.addEventListener('click', () => {
    if (state.user) window.location.hash = '#/profile';
    else $('#authModal').hidden = false;
  });
  $('#sideUserChip')?.addEventListener('click', () => {
    if (state.user) window.location.hash = '#/profile';
    else $('#authModal').hidden = false;
  });
  $('#drawerUserCard')?.addEventListener('click', () => {
    $('#drawerOverlay').hidden = true;
    if (state.user) window.location.hash = '#/profile';
    else $('#authModal').hidden = false;
  });
  $('#btnAuthClose')?.addEventListener('click', () => { $('#authModal').hidden = true; });

  $('#btnOpenAuth')?.addEventListener('click', () => {
    if (state.user) {
      signOut(auth).then(() => toast('Déconnecté'));
    } else {
      $('#authModal').hidden = false;
    }
  });
}

function renderLibrary() {
  const grid = $('#libraryGrid');
  const empty = $('#libraryEmpty');
  if (!grid) return;

  const rawFavs = localStorage.getItem('otaku_manga_favorites');
  const favs = rawFavs ? JSON.parse(rawFavs) : [];

  $('#countFav').textContent = favs.length;

  if (!favs.length) {
    grid.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  grid.innerHTML = favs.map(f => `
    <article class="card" data-id="${f.id}" tabindex="0" role="button">
      <div class="card-poster">
        <img loading="lazy" src="${f.coverUrl}" alt="${f.title}">
      </div>
      <h3 class="card-title">${f.title}</h3>
      <span class="card-sub">MANGA</span>
    </article>
  `).join('');

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => window.openMangaDetail(card.dataset.id));
  });
}

function initLibraryTabs() {
  $('#libTabs')?.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#libTabs .chip.active')?.classList.remove('active');
      btn.classList.add('active');
      renderLibrary();
    });
  });
}

/* ==========================================================
   ESPACE PROFIL KOVA — NIVEAU, XP, BADGES & AVATARS
   ========================================================== */
const KOVA_XP_KEY = 'kova_user_xp';
const KOVA_AVATAR_KEY = 'kova_user_avatar';

function getUserXp() {
  return parseInt(localStorage.getItem(KOVA_XP_KEY) || '0', 10);
}

function addKovaXp(amount = 50) {
  const current = getUserXp();
  const next = current + amount;
  localStorage.setItem(KOVA_XP_KEY, String(next));
  updateProfileKovaUI();
}

function calculateKovaLevel(xp) {
  const level = Math.floor(xp / 100) + 1;
  const currentLevelXp = xp % 100;
  return { level, currentLevelXp, nextLevelXp: 100, percent: currentLevelXp };
}

function updateProfileKovaUI() {
  const xp = getUserXp();
  const { level, currentLevelXp, percent } = calculateKovaLevel(xp);

  const levelEl = $('#userLevelNum');
  if (levelEl) levelEl.textContent = level;

  const curEl = $('#userXpCurrent');
  if (curEl) curEl.textContent = currentLevelXp;

  const barEl = $('#userXpBarFill');
  if (barEl) barEl.style.width = `${percent}%`;

  if (xp >= 100) $('#badgeReader')?.classList.add('unlocked');
  if (level >= 5) $('#badgeOtaku')?.classList.add('unlocked');

  const rawFavs = localStorage.getItem('otaku_manga_favorites');
  const favCount = rawFavs ? JSON.parse(rawFavs).length : 0;
  if (favCount >= 5) $('#badgeCollector')?.classList.add('unlocked');

  const savedAvatar = localStorage.getItem(KOVA_AVATAR_KEY);
  if (savedAvatar) {
    const profImg = $('#profileAvatarBig');
    if (profImg) profImg.src = savedAvatar;
    const navImg = $('#navAvatar');
    if (navImg) navImg.src = savedAvatar;
    const sideImg = $('#sideAvatar');
    if (sideImg) sideImg.src = savedAvatar;
  }
}

/* ==========================================================
   BOOTSTRAP FIABLE (DÉBLOCAGE IMMÉDIAT DU SPLASH SCREEN)
   ========================================================== */
function boot() {
  initNavigation();
  initRouter();
  initCatalogEvents();
  initLibraryTabs();
  initAuth();
  initReaderControls();
  loadHome();
  updateProfileKovaUI();

  // Déblocage immédiat de l'affichage / suppression du splash
  const splash = $('#splash');
  if (splash) {
    splash.classList.add('hidden');
    splash.style.transition = 'opacity 0.15s ease'; splash.style.opacity = '0'; setTimeout(() => { splash.remove(); }, 160);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Sécurité supplémentaire : forcer la disparition du splash après 800ms
setTimeout(() => {
  const splash = $('#splash');
  if (splash) splash.remove();
}, 250);


/* Écouteur global pour kova-catalog.js */
document.addEventListener('kova:open', (e) => {
  const { source, id, title } = e.detail || {};
  if (source === 'mangadex' && id) {
    if (typeof window.openMangaDetail === 'function') {
      window.openMangaDetail(id);
    }
  } else if (source === 'anilist' && id) {
    toast();
  }
});
