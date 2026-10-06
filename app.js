import { mangadexAdapter } from './mangadexAdapter.js';

function setupCarouselAccessibility(scrollEl) {
  if (!scrollEl || scrollEl.dataset.carouselInit) return;
  scrollEl.dataset.carouselInit = 'true';

  // Navigation fluide au clavier (Flèches gauche / droite)
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

  // Gestion des cartes au clavier (Entrée / Espace pour ouvrir)
  scrollEl.querySelectorAll('.card').forEach(card => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

// Initialisation globale des boutons précédent / suivant des carrousels
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


// Placeholder SVG Otaku-World élégant et résilient
function getPosterPlaceholderSvg(title = 'Otaku-World') {
  const safeTitle = String(title).replace(/[&<>'"\/]/g, '');
  return  + encodeURIComponent();
}

// Gestionnaire d'erreur d'affiche avec nouvelle tentative discrète puis fallback propre
window.handleImageError = function(img, fallbackUrl, title) {
  if (!img) return;
  const attempts = parseInt(img.dataset.retryCount || '0', 10);
  if (attempts === 0 && fallbackUrl && fallbackUrl !== img.src) {
    img.dataset.retryCount = '1';
    // Tentative discrète avec fallback de résolution
    setTimeout(() => {
      img.src = fallbackUrl;
    }, 1200);
  } else if (attempts === 1) {
    img.dataset.retryCount = '2';
    // Seconde tentative discrète avec cache-busting
    setTimeout(() => {
      const sep = img.src.includes('?') ? '&' : '?';
      img.src = img.src + sep + 't=' + Date.now();
    }, 1500);
  } else {
    // Remplacement silencieux et propre par le placeholder SVG
    img.onerror = null;
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.src = getPosterPlaceholderSvg(title);
    img.classList.add('poster-fallback');
  }
};

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { ref, get, set, remove, onValue } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

/* ---------- État de l'application ---------- */
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
    genre: '',
    items: []
  },
  homeHeroItems: [],
  heroIndex: 0,
  heroTimer: null,
  planningDay: 0
};

const ANILIST = 'https://graphql.anilist.co';

/* ---------- Helpers DOM & Toast ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- AniList API Client ---------- */
async function anilist(query, variables = {}) {
  const res = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error('API AniList indisponible');
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

const CARD_FIELDS = `
  id title { romaji english native } coverImage { extraLarge large medium color }
  bannerImage averageScore format seasonYear status episodes chapters
`;

function mediaType(m) {
  return m.format && /MANGA|NOVEL|ONE_SHOT/.test(m.format) ? 'MANGA' : 'ANIME';
}

function cardHTML(m) {
  const title = (m.title.romaji || m.title.english || m.title.native || 'Sans titre').replace(/"/g, '&quot;');
  const c = m.coverImage || {};
  const imgMedium = c.medium || '';
  const imgLarge = c.large || c.extraLarge || '';
  const imgExtraLarge = c.extraLarge || c.large || '';
  const fallbackUrl = imgLarge || imgMedium || '';
  
  // Variantes adaptatives srcset & sizes
  const srcSetArr = [];
  if (imgMedium) srcSetArr.push(`${imgMedium} 160w`);
  if (imgLarge && imgLarge !== imgMedium) srcSetArr.push(`${imgLarge} 230w`);
  if (imgExtraLarge && imgExtraLarge !== imgLarge) srcSetArr.push(`${imgExtraLarge} 460w`);
  const srcSetAttr = srcSetArr.length > 1 ? `srcset="${srcSetArr.join(', ')}" sizes="(max-width: 640px) 130px, (max-width: 1024px) 170px, 200px"` : '';

  const score = m.averageScore ? (m.averageScore / 10).toFixed(1) : null;
  const sub = [m.format || 'ANIME', m.seasonYear].filter(Boolean).join(' • ');

  return `
    <article class="card" data-id="${m.id}" tabindex="0" role="button" aria-label="${title}, ${m.format || 'Anime'}, ${score ? 'note ' + score + ' sur 10' : ''}">
      <div class="card-poster">
        <img loading="lazy" decoding="async" src="${imgLarge || imgExtraLarge}" ${srcSetAttr} alt="Affiche de ${title}" onerror="handleImageError(this, '${fallbackUrl}', '${title.replace(/'/g, "\'")}')">
        ${score ? `<span class="card-score">★ ${score}</span>` : ''}
        <span class="card-format">${m.format || 'ANIME'}</span>
      </div>
      <h3 class="card-title">${title}</h3>
      <span class="card-sub">${sub}</span>
    </article>`;
}

function bindCards(container, list) {
  if (!container) return;
  container.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = list.find(x => String(x.id) === String(id));
      if (item && item.isMangaDex) {
        window.openMangaDetail(id);
      } else if (id && id.length > 20) {
        // UUID MangaDex
        window.openMangaDetail(id);
      } else {
        openDetail(id);
      }
    });
  });
}


/* ==========================================================
   1. SOCLE TECHNIQUE & ROUTAGE (Hash Router)
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
  else if (path === 'anime' && param) {
    route = 'detail';
    state.mediaId = param;
  }

  state.currentRoute = route;

  // Cacher toutes les vues puis afficher la vue active
  const views = {
    home: $('#viewHome'),
    catalogue: $('#viewCatalogue'),
    planning: $('#viewPlanning'),
    library: $('#viewLibrary'),
    profile: $('#viewProfile'),
    detail: $('#viewDetail')
  };

  Object.entries(views).forEach(([k, el]) => {
    if (el) el.hidden = (k !== route);
  });

  // Mise à jour des liens actifs dans les navs
  $$('[data-route]').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });
  $$('.drawer-link').forEach(link => {
    const target = link.getAttribute('href').replace('#/', '') || 'home';
    link.classList.toggle('active', target === route);
  });

  // Fermer le tiroir si ouvert
  $('#drawerOverlay').hidden = true;
  window.scrollTo(0, 0);

  // Déclenchement spécifique à la page
  if (route === 'catalogue') {
    if (!state.catalog.items.length) fetchCatalog(true);
  } else if (route === 'planning') {
    loadPlanning(state.planningDay);
  } else if (route === 'library') {
    renderLibrary();
  } else if (route === 'detail' && state.mediaId) {
    loadDetail(state.mediaId);
  }
}

/* ==========================================================
   2. ACCUEIL (Hero responsive + Carrousels réels)
   ========================================================== */
function feedRowHTML(title, id, filterVal) {
  return `
    <section class="feed-row" role="region" aria-roledescription="carrousel" aria-label="${title}">
      <div class="feed-head">
        <h2 class="feed-title">${title}</h2>
        <div class="carousel-controls">
          <button class="carousel-btn prev" type="button" aria-label="Faire défiler ${title} vers la gauche" data-target="${id}" tabindex="0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="carousel-btn next" type="button" aria-label="Faire défiler ${title} vers la droite" data-target="${id}" tabindex="0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <a href="#/catalogue" class="feed-see-all" data-quick-sort="${filterVal}">Tout voir &rarr;</a>
        </div>
      </div>
      <div class="feed-scroll" id="${id}" role="group" aria-live="polite" tabindex="0" aria-label="Liste des éléments du carrousel ${title}"></div>
    </section>`;
}

async function loadHome() {
  const container = $('#feedContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="section-block">
      <div class="section-header">
        <h2 class="section-title">🔥 Tendances Manga & Webtoon</h2>
      </div>
      <div class="carousel" id="carouselTrendingManga"><div class="catalog-loading"><div class="spinner"></div></div></div>
    </div>
    <div class="section-block">
      <div class="section-header">
        <h2 class="section-title">⭐ Les Mieux Notés</h2>
      </div>
      <div class="carousel" id="carouselTopManga"><div class="catalog-loading"><div class="spinner"></div></div></div>
    </div>
    <div class="section-block">
      <div class="section-header">
        <h2 class="section-title">⚡ Derniers Ajouts & Chapitres</h2>
      </div>
      <div class="carousel" id="carouselLatestManga"><div class="catalog-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  try {
    // 1. Tendances
    const trendingRes = await mangadexAdapter.getCatalogue({ sort: 'followedCount', limit: 12 });
    const trendingItems = trendingRes.items.map(m => ({
      id: m.id,
      format: m.type.toUpperCase(),
      title: { romaji: m.title.display },
      coverImage: { large: m.coverUrl },
      averageScore: m.score.value ? Math.round(m.score.value * 10) : null,
      seasonYear: m.year,
      isMangaDex: true
    }));
    $('#carouselTrendingManga').innerHTML = trendingItems.map(cardHTML).join('');
    bindCards($('#carouselTrendingManga'), trendingItems);

    // Initialiser le Hero avec les 5 premiers mangas tendances
    state.heroMedia = trendingItems.slice(0, 5);
    renderHero();

    // 2. Mieux notés
    const topRes = await mangadexAdapter.getCatalogue({ sort: 'rating', limit: 12 });
    const topItems = topRes.items.map(m => ({
      id: m.id,
      format: m.type.toUpperCase(),
      title: { romaji: m.title.display },
      coverImage: { large: m.coverUrl },
      averageScore: m.score.value ? Math.round(m.score.value * 10) : null,
      seasonYear: m.year,
      isMangaDex: true
    }));
    $('#carouselTopManga').innerHTML = topItems.map(cardHTML).join('');
    bindCards($('#carouselTopManga'), topItems);

    // 3. Derniers ajouts
    const latestRes = await mangadexAdapter.getCatalogue({ sort: 'latest', limit: 12 });
    const latestItems = latestRes.items.map(m => ({
      id: m.id,
      format: m.type.toUpperCase(),
      title: { romaji: m.title.display },
      coverImage: { large: m.coverUrl },
      averageScore: m.score.value ? Math.round(m.score.value * 10) : null,
      seasonYear: m.year,
      isMangaDex: true
    }));
    $('#carouselLatestManga').innerHTML = latestItems.map(cardHTML).join('');
    bindCards($('#carouselLatestManga'), latestItems);

  } catch (err) {
    console.error('Erreur chargement accueil manga:', err);
  }
}


function fillFeedRow(rowId, list) {
  const el = document.getElementById(rowId);
  if (!el) return;
  el.innerHTML = list.map(cardHTML).join('');
  bindCards(el, list);
  setupCarouselAccessibility(el);
}

function setupHeroSlider(items) {
  if (!items.length) return;
  const dotsContainer = $('#heroDots');
  dotsContainer.innerHTML = items.map((_, i) => `<span class="hero-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`).join('');
  dotsContainer.querySelectorAll('.hero-dot').forEach(dot => {
    dot.onclick = () => {
      clearInterval(state.heroTimer);
      state.heroIndex = parseInt(dot.dataset.idx, 10);
      renderHeroItem(items[state.heroIndex]);
      startHeroTimer();
    };
  });
  renderHeroItem(items[0]);
  startHeroTimer();
}

function startHeroTimer() {
  clearInterval(state.heroTimer);
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return; // Pas d'auto-défilement si animations réduites demandées
  }
  state.heroTimer = setInterval(() => {
    if (!state.homeHeroItems.length || state.currentRoute !== 'home') return;
    state.heroIndex = (state.heroIndex + 1) % state.homeHeroItems.length;
    renderHeroItem(state.homeHeroItems[state.heroIndex]);
  }, 6500);
}

function renderHeroItem(m) {
  if (!m) return;
  const backdrop = $('#heroBackdrop');
  const bannerUrl = m.bannerImage || '';
  const posterUrl = m.coverImage?.extraLarge || m.coverImage?.large || '';
  const heroImageSrc = bannerUrl || posterUrl;
  
  if (heroImageSrc) {
    const testImg = new Image();
    testImg.src = heroImageSrc;
    testImg.onload = () => {
      backdrop.style.backgroundImage = `url(${heroImageSrc})`;
      backdrop.classList.add('hero-loaded');
    };
    testImg.onerror = () => {
      if (bannerUrl && posterUrl && bannerUrl !== posterUrl) {
        backdrop.style.backgroundImage = `url(${posterUrl})`;
      } else {
        backdrop.style.backgroundImage = 'radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.35) 0%, rgba(15, 12, 29, 0.95) 75%)';
      }
    };
  } else {
    backdrop.style.backgroundImage = 'radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.35) 0%, rgba(15, 12, 29, 0.95) 75%)';
  }

  const title = m.title.romaji || m.title.english || 'Titre';
  const score = m.averageScore ? (m.averageScore / 10).toFixed(1) : null;
  const meta = [m.format || 'ANIME', m.seasonYear, m.status].filter(Boolean).join(' • ');

  $('#heroContent').innerHTML = `
    <span class="hero-badge">⚡ TOP SIMULCAST</span>
    <h1 class="hero-title">${title}</h1>
    <div class="hero-meta">
      ${score ? `<span class="score">★ ${score} / 10</span> • ` : ''}
      <span>${meta}</span>
    </div>
    <p class="hero-desc">${m.description ? m.description.replace(/<[^>]*>?/gm, '') : 'Découvrez cet anime sur Otaku-World.'}</p>
    <div class="hero-actions">
      <button class="btn-primary" id="btnHeroWatch">▶ Voir la fiche</button>
      <button class="btn-secondary" id="btnHeroList">＋ Ajouter à ma liste</button>
    </div>`;

  $$('#heroDots .hero-dot').forEach((d, i) => d.classList.toggle('active', i === state.heroIndex));

  $('#btnHeroWatch').onclick = () => { window.location.hash = `#/anime/${m.id}`; };
  $('#btnHeroList').onclick = () => toggleLibraryItem('watchlist', m);
}

/* ==========================================================
   3. CATALOGUE COMPLET AVEC RECHERCHE & FILTRES FONCTIONNELS
   ========================================================== */
let catalogSearchTimer;

function initCatalogEvents() {
  $('#catSearchInput').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    $('#catSearchClear').hidden = !val;
    clearTimeout(catalogSearchTimer);
    catalogSearchTimer = setTimeout(() => {
      state.catalog.query = val;
      fetchCatalog(true);
    }, 400);
  });

  $('#catSearchClear').addEventListener('click', () => {
    $('#catSearchInput').value = '';
    $('#catSearchClear').hidden = true;
    state.catalog.query = '';
    fetchCatalog(true);
  });

  // Filtre Format (TV, MOVIE, MANGA)
  $$('#filterFormat .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#filterFormat .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      state.catalog.format = btn.dataset.val;
      fetchCatalog(true);
    });
  });

  // Filtre Tri (Tendances, Popularité, Mieux notés, Nouveautés)
  $$('#filterSort .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#filterSort .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      state.catalog.sort = btn.dataset.val;
      fetchCatalog(true);
    });
  });

  // Filtre Genre
  $$('#filterGenres .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#filterGenres .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      state.catalog.genre = btn.dataset.genre;
      fetchCatalog(true);
    });
  });

  // Bouton Charger Plus
  $('#btnLoadMore').addEventListener('click', () => {
    if (!state.catalog.loading && state.catalog.hasNextPage) {
      state.catalog.page++;
      fetchCatalog(false);
    }
  });

  // Raccourci touche '/' pour la recherche
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      window.location.hash = '#/catalogue';
      setTimeout(() => $('#catSearchInput').focus(), 150);
    }
  });

  // Barre de recherche dans le topbar
  $('#quickSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      window.location.hash = '#/catalogue';
      $('#catSearchInput').value = q;
      state.catalog.query = q;
      fetchCatalog(true);
    }
  });
}

async function fetchCatalog(reset = false) {
  if (state.catalog.loading) return;
  state.catalog.loading = true;

  if (reset) {
    state.catalog.page = 1;
    state.catalog.items = [];
    $('#catalogGrid').innerHTML = '';
    $('#catalogEmpty').hidden = true;
  }

  $('#catalogLoading').hidden = false;
  $('#catalogMoreWrap').hidden = true;

  // --- BRANCHEMENT MANGA : MangaDex Adapter ---
  if (state.catalog.format === 'MANGA') {
    try {
      let mdSort = 'followedCount';
      let mdSortOrder = 'desc';
      if (state.catalog.sort === 'SCORE_DESC') mdSort = 'rating';
      else if (state.catalog.sort === 'START_DATE_DESC') mdSort = 'latest';
      else if (state.catalog.sort === 'TITLE_ROMAJI') { mdSort = 'title'; mdSortOrder = 'asc'; }

      const mangaRes = await mangadexAdapter.getCatalogue({
        query: state.catalog.query || '',
        sort: mdSort,
        sortOrder: mdSortOrder,
        page: state.catalog.page,
        limit: 24
      });

      const mangaItems = (mangaRes.items || []).map(m => ({
        id: m.id,
        format: m.type.toUpperCase(),
        title: {
          romaji: m.title.display,
          english: m.title.en,
          native: m.title.original
        },
        coverImage: {
          large: m.coverUrl,
          medium: m.coverUrl,
          extraLarge: m.coverUrl
        },
        averageScore: m.score.value ? Math.round(m.score.value * 10) : null,
        seasonYear: m.year,
        isMangaDex: true,
        mangaData: m
      }));

      state.catalog.hasNextPage = mangaRes.hasMore;
      state.catalog.items = reset ? mangaItems : [...state.catalog.items, ...mangaItems];

      $('#catalogCount').textContent = `${mangaRes.total ? mangaRes.total.toLocaleString('fr-FR') : mangaItems.length} mangas trouvés`;

      if (reset) {
        $('#catalogGrid').innerHTML = mangaItems.map(cardHTML).join('');
      } else {
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
      console.error('[Catalogue Manga] Erreur:', err);
      if (reset) {
        $('#catalogGrid').innerHTML = '';
        $('#catalogEmpty').hidden = false;
        $('#catalogEmpty').querySelector('p').textContent = 'Erreur lors du chargement des mangas: ' + err.message;
      }
    } finally {
      state.catalog.loading = false;
      $('#catalogLoading').hidden = true;
    }
    return;
  }

  // --- BRANCHE ANIME : AniList GraphQL Intacte ---
  if (state.catalog.loading) return;
  state.catalog.loading = true;

  if (reset) {
    state.catalog.page = 1;
    state.catalog.items = [];
    $('#catalogGrid').innerHTML = '';
    $('#catalogEmpty').hidden = true;
  }

  $('#catalogLoading').hidden = false;
  $('#catalogMoreWrap').hidden = true;

  const type = state.catalog.format === 'MANGA' ? 'MANGA' : 'ANIME';
  let formatParam = undefined;
  if (state.catalog.format === 'TV') formatParam = 'TV';
  if (state.catalog.format === 'MOVIE') formatParam = 'MOVIE';

  const vars = {
    page: state.catalog.page,
    perPage: 24,
    type: type,
    sort: [state.catalog.sort]
  };

  if (state.catalog.query) vars.search = state.catalog.query;
  if (formatParam) vars.format = formatParam;
  if (state.catalog.genre) vars.genre = state.catalog.genre;

  const query = `
    query ($page: Int, $perPage: Int, $type: MediaType, $sort: [MediaSort], $search: String, $format: MediaFormat, $genre: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(type: $type, sort: $sort, search: $search, format: $format, genre: $genre, isAdult: false) {
          ${CARD_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await anilist(query, vars);
    const { media, pageInfo } = data.Page;

    state.catalog.hasNextPage = pageInfo.hasNextPage;
    state.catalog.items = reset ? media : [...state.catalog.items, ...media];

    $('#catalogCount').textContent = `${pageInfo.total ? pageInfo.total.toLocaleString('fr-FR') : media.length} résultats`;

    if (reset) {
      $('#catalogGrid').innerHTML = media.map(cardHTML).join('');
    } else {
      const div = document.createElement('div');
      div.innerHTML = media.map(cardHTML).join('');
      while (div.firstChild) $('#catalogGrid').appendChild(div.firstChild);
    }

    bindCards($('#catalogGrid'), state.catalog.items);

    if (!state.catalog.items.length) {
      $('#catalogEmpty').hidden = false;
    } else if (pageInfo.hasNextPage) {
      $('#catalogMoreWrap').hidden = false;
    }
  } catch (err) {
    if (reset) {
      $('#catalogGrid').innerHTML = '';
      $('#catalogEmpty').hidden = false;
      $('#catalogEmpty').querySelector('p').textContent = err.message;
    }
  } finally {
    state.catalog.loading = false;
    $('#catalogLoading').hidden = true;
  }
}

/* ==========================================================
   4. PLANNING DE DIFFUSION (Airing Schedule)
   ========================================================== */
async function loadPlanning(dayOffset = 0) {
  state.planningDay = dayOffset;
  const grid = $('#planningGrid');
  grid.innerHTML = '<div class="catalog-loading"><div class="spinner"></div></div>';

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 23, 59, 59);

  const startSec = Math.floor(startOfDay.getTime() / 1000);
  const endSec = Math.floor(endOfDay.getTime() / 1000);

  const query = `
    query ($start: Int, $end: Int) {
      Page(perPage: 30) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id episode airingAt
          media {
            id title { romaji english } coverImage { large }
            format countryOfOrigin
          }
        }
      }
    }
  `;

  try {
    const data = await anilist(query, { start: startSec, end: endSec });
    const schedules = data.Page.airingSchedules;

    if (!schedules.length) {
      grid.innerHTML = '<div class="catalog-empty"><div class="empty-icon">📅</div><h3>Aucune sortie planifiée</h3><p>Aucun nouvel épisode répertorié pour ce jour.</p></div>';
      return;
    }

    grid.innerHTML = schedules.map(s => {
      const m = s.media;
      const date = new Date(s.airingAt * 1000);
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const title = m.title.romaji || m.title.english;
      return `
        <div class="planning-card" data-id="${m.id}">
          <div class="planning-poster">
            <img loading="lazy" src="${m.coverImage?.large || ''}" alt="${title}">
          </div>
          <div class="planning-info">
            <span class="planning-time">🕒 ${timeStr} (Japon)</span>
            <strong class="planning-title">${title}</strong>
            <span class="planning-episode">Épisode ${s.episode} • ${m.format || 'TV'}</span>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.planning-card').forEach(el => {
      el.addEventListener('click', () => {
        window.location.hash = `#/anime/${el.dataset.id}`;
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="catalog-empty"><div class="empty-icon">⚠️</div><h3>Erreur du planning</h3><p>${err.message}</p></div>`;
  }
}

function updatePlanningTabs() {
  const container = $('#planningDays');
  if (!container) return;
  const labels = ['Aujourd\'hui', 'Demain'];
  const now = new Date();
  container.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    let label = labels[i];
    if (!label) {
      const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      label = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    }
    return `<button class="day-tab ${i === state.planningDay ? 'active' : ''}" data-day="${i}">${label}</button>`;
  }).join('');
  updatePlanningTabs();
}
function initPlanningEvents() {
  $$('#planningDays .day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#planningDays .day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadPlanning(parseInt(tab.dataset.day, 10));
    });
  });
}

/* ==========================================================
   5. FICHE DÉTAILLÉE
   ========================================================== */
async function loadDetail(id) {
  const container = $('#detailContainer');
  container.innerHTML = '<div class="catalog-loading" style="padding:100px 0"><div class="spinner"></div></div>';

  const query = `
    query ($id: Int) {
      Media(id: $id) {
        id title { romaji english native }
        coverImage { extraLarge large medium color }
        bannerImage averageScore format seasonYear status
        description(asHtml: false) episodes chapters duration
        genres studios(isMain: true) { nodes { name } }
        trailer { id site } externalLinks { site url }
        recommendations(perPage: 6) { nodes { mediaRecommendation { ${CARD_FIELDS} } } }
      }
    }
  `;

  try {
    const data = await anilist(query, { id: parseInt(id, 10) });
    const m = data.Media;
    renderDetail(m);
  } catch (err) {
    container.innerHTML = `<div class="catalog-empty"><div class="empty-icon">⚠️</div><h3>Impossible de charger la fiche</h3><p>${err.message}</p></div>`;
  }
}

function renderDetail(m) {
  const title = m.title.romaji || m.title.english || m.title.native;
  const score = m.averageScore ? (m.averageScore / 10).toFixed(1) : null;
  const studio = m.studios?.nodes?.[0]?.name;
  const recs = (m.recommendations?.nodes || []).map(r => r.mediaRecommendation).filter(Boolean);

  const container = $('#detailContainer');
  container.innerHTML = `
    <div class="hero" style="height:44vh;min-height:300px">
      <div class="hero-backdrop" style="background-image:url(${m.bannerImage || m.coverImage?.extraLarge || ''})"></div>
      <div class="hero-fade"></div>
      <div class="hero-content">
        <h1 class="hero-title" style="font-size:clamp(22px,5vw,36px)">${title}</h1>
        <div class="hero-meta">
          ${score ? `<span class="score">★ ${score}</span> • ` : ''}
          <span>${[m.format, m.seasonYear, m.status].filter(Boolean).join(' • ')}</span>
        </div>
        <div class="hero-actions">
          <button class="btn-primary" id="btnDetailFav">♥ Favori</button>
          <button class="btn-secondary" id="btnDetailWatch">⏱ À regarder</button>
          <button class="btn-secondary" id="btnDetailHist">👁 Déjà vu</button>
        </div>
      </div>
    </div>

    <div style="padding:20px 16px;max-width:960px;margin:0 auto">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Synopsis</h3>
      <p class="hero-desc" style="-webkit-line-clamp:unset;font-size:14px;color:var(--text-muted);line-height:1.6">
        ${m.description ? m.description.replace(/<[^>]*>?/gm, '') : 'Aucun synopsis disponible.'}
      </p>

      <div class="chip-row" style="margin-top:14px;flex-wrap:wrap">
        ${(m.genres || []).map(g => `<span class="chip active">${g}</span>`).join('')}
        ${studio ? `<span class="chip">Studio : ${studio}</span>` : ''}
        ${m.episodes ? `<span class="chip">${m.episodes} épisodes</span>` : ''}
      </div>

      ${m.trailer?.site === 'youtube' ? `
        <h3 style="font-size:16px;font-weight:700;margin:28px 0 12px">Bande-annonce officielle</h3>
        <div style="position:relative;width:100%;aspect-ratio:16/9;border-radius:var(--radius-md);overflow:hidden;background:#000">
          <iframe style="width:100%;height:100%;border:none" src="https://www.youtube-nocookie.com/embed/${m.trailer.id}" allowfullscreen loading="lazy"></iframe>
        </div>` : ''}

      ${(m.externalLinks || []).length ? `
        <h3 style="font-size:16px;font-weight:700;margin:28px 0 12px">Diffusion officielle</h3>
        <div class="chip-row" style="flex-wrap:wrap">
          ${m.externalLinks.filter(l => l.url).map(l => `<a class="chip" style="text-decoration:none" href="${l.url}" target="_blank" rel="noopener">🔗 ${l.site}</a>`).join('')}
        </div>` : ''}

      ${recs.length ? `
        <h3 style="font-size:16px;font-weight:700;margin:28px 0 12px">Titres similaires</h3>
        <div class="feed-scroll" id="detailRecs"></div>` : ''}
    </div>`;

  if (recs.length) {
    fillFeedRow('detailRecs', recs);
  }

  $('#btnDetailFav').onclick = () => toggleLibraryItem('favorites', m);
  $('#btnDetailWatch').onclick = () => toggleLibraryItem('watchlist', m);
  $('#btnDetailHist').onclick = () => toggleLibraryItem('history', m);
}

/* ==========================================================
   6. BIBLIOTHÈQUE & SYNCHRONISATION FIREBASE
   ========================================================== */
async function toggleLibraryItem(list, m) {
  if (!state.user) {
    $('#authModal').hidden = false;
    return toast('Veuillez vous connecter d\u2019abord');
  }

  const uid = state.user.uid;
  const key = `${mediaType(m)}-${m.id}`;
  const itemRef = ref(db, `${list}/${uid}/${key}`);

  if (state.library[list]?.[key]) {
    await remove(itemRef);
    toast(`Retiré de vos ${list === 'favorites' ? 'favoris' : list}`);
  } else {
    await set(itemRef, {
      id: m.id,
      type: mediaType(m),
      title: m.title.romaji || m.title.english || 'Titre',
      cover: m.coverImage?.large || m.coverImage?.extraLarge || '',
      score: m.averageScore || null,
      format: m.format || 'ANIME',
      year: m.seasonYear || null,
      addedAt: Date.now()
    });
    toast(`Ajouté à vos ${list === 'favorites' ? 'favoris' : list}`);
  }
}

function watchLibraryData() {
  if (!state.user) return;
  const uid = state.user.uid;
  ['favorites', 'watchlist', 'history'].forEach(list => {
    onValue(ref(db, `${list}/${uid}`), snap => {
      state.library[list] = snap.val() || {};
      updateLibraryCounts();
      if (state.currentRoute === 'library') renderLibrary();
    });
  });
  onValue(ref(db, `progress/${uid}`), snap => {
    state.progress = snap.val() || {};
  });
}

function updateLibraryCounts() {
  $('#countFav').textContent = Object.keys(state.library.favorites || {}).length;
  $('#countWatch').textContent = Object.keys(state.library.watchlist || {}).length;
  $('#countHist').textContent = Object.keys(state.library.history || {}).length;
}

function renderLibrary() {
  const grid = $('#libraryGrid');
  const empty = $('#libraryEmpty');
  const items = Object.entries(state.library[state.libTab] || {});

  if (!items.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    $('#libEmptyTitle').textContent = state.user ? 'Cette liste est vide' : 'Connectez-vous pour voir votre bibliothèque';
    return;
  }

  empty.hidden = true;
  grid.innerHTML = items.map(([key, v]) => `
    <article class="card" data-key="${key}" data-id="${v.id}">
      <div class="card-poster">
        <img loading="lazy" src="${v.cover || ''}" alt="${v.title}">
        ${v.score ? `<span class="card-score">★ ${(v.score / 10).toFixed(1)}</span>` : ''}
        <span class="card-format">${v.format || 'ANIME'}</span>
      </div>
      <h3 class="card-title">${v.title}</h3>
      <span class="card-sub">${[v.format, v.year].filter(Boolean).join(' • ')}</span>
    </article>`).join('');

  grid.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = `#/anime/${el.dataset.id}`;
    });
  });
}

function initLibraryTabs() {
  $$('#libTabs .chip').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#libTabs .chip').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      state.libTab = tab.dataset.list;
      renderLibrary();
    });
  });
}

/* ==========================================================
   7. NAVIGATION MOBILE (Tiroir) & AUTH MODAL
   ========================================================== */
function initNavigation() {
  // Tiroir mobile
  $('#btnDrawerOpen').addEventListener('click', () => {
    $('#drawerOverlay').hidden = false;
  });
  $('#btnDrawerClose').addEventListener('click', () => {
    $('#drawerOverlay').hidden = true;
  });
  $('#drawerOverlay').addEventListener('click', (e) => {
    if (e.target === $('#drawerOverlay')) $('#drawerOverlay').hidden = true;
  });

  // Bouton retour détail
  $('#btnBackDetail').addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '#/';
  });

  // Partage
  $('#btnShareDetail').addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast('Lien copié dans le presse-papier !');
    }
  });

  // Auth modal open/close
  $('#btnUserMenu').addEventListener('click', () => {
    if (state.user) window.location.hash = '#/profile';
    else $('#authModal').hidden = false;
  });
  $('#sideUserChip').addEventListener('click', () => {
    if (state.user) window.location.hash = '#/profile';
    else $('#authModal').hidden = false;
  });
  $('#drawerUserCard').addEventListener('click', () => {
    $('#drawerOverlay').hidden = true;
    if (state.user) window.location.hash = '#/profile';
    else $('#authModal').hidden = false;
  });
  $('#btnAuthClose').addEventListener('click', () => {
    $('#authModal').hidden = true;
  });
  $('#btnOpenAuth').addEventListener('click', () => {
    if (state.user) {
      signOut(auth).then(() => toast('Déconnecté'));
    } else {
      $('#authModal').hidden = false;
    }
  });
}

/* ==========================================================
   8. AUTHENTIFICATION FIREBASE
   ========================================================== */
let authIsLogin = true;

function initAuth() {
  const btnGoogle = $('#btnGoogleAuth');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      const errEl = $('#authError');
      errEl.hidden = true;
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        $('#authModal').hidden = true;
        toast('Connexion Google réussie !');
      } catch (err) {
        errEl.hidden = false;
        errEl.textContent = err.message;
      }
    });
  }

  $('#btnAuthToggle').addEventListener('click', (e) => {
    e.preventDefault();
    authIsLogin = !authIsLogin;
    $('#authTitle').textContent = authIsLogin ? 'Connexion' : 'Créer un compte';
    $('#authSubmit').textContent = authIsLogin ? 'Se connecter' : 'Créer le compte';
    $('#authSwitchPrompt').textContent = authIsLogin ? "Vous n'avez pas de compte ?" : 'Déjà un compte ?';
    $('#btnAuthToggle').textContent = authIsLogin ? 'Créer un compte' : 'Se connecter';
  });

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#authEmail').value.trim();
    const pass = $('#authPass').value;
    const errEl = $('#authError');
    errEl.hidden = true;

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
    }
  });

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    if (user) {
      reconcileMangaProgressWithFirebase(user);
      const name = user.displayName || user.email.split('@')[0];
      const avatar = user.photoURL || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\'%3E%3Crect width=\'64\' height=\'64\' rx=\'32\' fill=\'%238b5cf6\'/%3E%3Ctext x=\'32\' y=\'40\' text-anchor=\'middle\' fill=\'%23ffffff\' font-size=\'22\' font-weight=\'bold\'%3E' + name[0].toUpperCase() + '%3C/text%3E%3C/svg%3E';

      $('#navAvatar').src = avatar;
      $('#sideAvatar').src = avatar;
      $('#drawerAvatar').src = avatar;
      $('#profileAvatarBig').src = avatar;

      $('#sideUserName').textContent = name;
      $('#sideUserRole').textContent = 'Membre Otaku';
      $('#drawerUserName').textContent = name;
      $('#drawerUserSub').textContent = 'Connecté';

      $('#profileUsername').textContent = name;
      $('#profileEmail').textContent = user.email;
      $('#profileRoleBadge').textContent = 'Membre Otaku';
      $('#btnOpenAuth').textContent = 'Se déconnecter';

      watchLibraryData();
    } else {
      const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' rx='32' fill='%231f2338'/%3E%3Cpath d='M32 20a8 8 0 100 16 8 8 0 000-16zM18 48c0-7.7 6.3-14 14-14s14 6.3 14 14' fill='%238c90a4'/%3E%3C/svg%3E";
      $('#navAvatar').src = defaultAvatar;
      $('#sideAvatar').src = defaultAvatar;
      $('#drawerAvatar').src = defaultAvatar;
      $('#profileAvatarBig').src = defaultAvatar;

      $('#sideUserName').textContent = 'Invité';
      $('#sideUserRole').textContent = 'Non connecté';
      $('#drawerUserName').textContent = 'Invité';
      $('#drawerUserSub').textContent = 'Se connecter';

      $('#profileUsername').textContent = 'Invité';
      $('#profileEmail').textContent = 'Non connecté';
      $('#profileRoleBadge').textContent = 'Visiteur';
      $('#btnOpenAuth').textContent = 'Se connecter / S\'inscrire';

      state.library = { favorites: {}, watchlist: {}, history: {} };
      updateLibraryCounts();
    }
  });
}

/* ==========================================================
   9. DÉMARRAGE DE L'APPLICATION
   ========================================================== */
window.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initRouter();
  initCatalogEvents();
  updatePlanningTabs();
  initLibraryTabs();
  initAuth();
  loadHome();

  // Masquer le splash screen
  setTimeout(() => {
    const splash = $('#splash');
    if (splash) splash.classList.add('hidden');
  }, 500);
});

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}


/* ==========================================================
   OFFLINE SYNC & RAPPELS ENRICHIS
   ========================================================== */

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



/* ==========================================================
   LECTEUR MANGA / WEBTOON & FICHE MANGA
   ========================================================== */
let currentMangaState = {
  manga: null,
  chapters: [],
  currentChapterIndex: -1,
  currentPage: 1,
  totalPages: 1,
  dataSaver: false
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
    all[mangaId] = {
      ...data,
      updatedAt: Date.now()
    };
    localStorage.setItem(MANGA_PROGRESS_KEY, JSON.stringify(all));

    // Synchronisation Firebase si connecté
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
      } catch (err) {
        console.warn('Erreur sync Firebase progress:', err);
      }
    }
  } catch (e) {
    console.error('Erreur saveMangaProgress:', e);
  }
}

window.openMangaDetail = async function(mangaId) {
  const detailView = $('#viewDetail');
  if (!detailView) return;
  window.location.hash = `#/manga/${mangaId}`;
  
  detailView.innerHTML = '<div class="catalog-loading"><div class="spinner"></div><p style="color:#aaa;margin-top:10px;">Chargement de la fiche manga...</p></div>';
  detailView.hidden = false;
  $$('.view-page').forEach(v => { if (v.id !== 'viewDetail') v.hidden = true; });

  try {
    const manga = await mangadexAdapter.getMangaDetails(mangaId);
    const feed = await mangadexAdapter.getFeed(mangaId, { limit: 100 });
    currentMangaState.manga = manga;
    currentMangaState.chapters = feed.chapters || [];

    const progress = getMangaProgress(mangaId);
    const genresHtml = (manga.genres || []).map(g => `<span class="detail-tag">${g.name}</span>`).join('');
    
    let resumeBtnHtml = '';
    if (progress && progress.chapterId) {
      resumeBtnHtml = `<button type="button" class="btn-primary" id="btnResumeManga" style="background:#7c3aed;margin-right:10px;">▶ Reprendre Ch. ${progress.chapterNumber || ''} (p. ${progress.page || 1})</button>`;
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
      <div class="detail-container">
        <button type="button" class="btn-back" onclick="window.history.back()" style="margin-bottom:16px;">← Retour</button>
        <div class="detail-hero" style="display:flex;gap:24px;flex-wrap:wrap;">
          <img src="${manga.coverUrl}" alt="${manga.title.display}" style="width:200px;border-radius:12px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          <div style="flex:1;min-width:260px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span class="card-format" style="position:static;padding:4px 8px;">${manga.type.toUpperCase()}</span>
              ${manga.score.value ? `<span class="card-score" style="position:static;">★ ${manga.score.value}</span>` : ''}
              <span style="color:#888;font-size:0.85rem;">Statut: ${manga.status}</span>
            </div>
            <h1 style="color:#fff;font-size:1.8rem;margin-bottom:12px;">${manga.title.display}</h1>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${genresHtml}</div>
            <div style="margin-bottom:20px;">
              ${resumeBtnHtml}
              ${firstChapterId ? `<button type="button" class="btn-primary" id="btnStartManga">📖 Commencer à lire</button>` : ''}
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

    // Bindings fiche
    $('#btnResumeManga')?.addEventListener('click', () => {
      if (progress && progress.chapterId) {
        openMangaReader(manga.id, progress.chapterId, progress.page || 1);
      }
    });

    $('#btnStartManga')?.addEventListener('click', () => {
      if (firstChapterId) {
        openMangaReader(manga.id, firstChapterId, 1);
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

window.openMangaReader = async function(mangaId, chapterId, initialPage = 1) {
  const readerView = $('#viewMangaReader');
  if (!readerView) return;

  cancelNextChapterPrefetch();
  announceReader('Chargement du chapitre...');
  readerView.hidden = false;
  $('#readerLoading').hidden = false;
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
    sel.innerHTML = currentMangaState.chapters.map((c, i) => `
      <option value="${c.id}" ${c.id === chapterId ? 'selected' : ''}>
        ${c.title || 'Chapitre ' + c.chapter} (${c.language.toUpperCase()})
      </option>
    `).join('');
  }

  // Désactiver boutons précédents/suivants selon index
  const btnPrev = $('#btnPrevChapter');
  const btnNext = $('#btnNextChapter');
  if (btnPrev) btnPrev.disabled = chIndex >= currentMangaState.chapters.length - 1;
  if (btnNext) btnNext.disabled = chIndex <= 0;

  try {
    const pagesData = await mangadexAdapter.getChapterPages(chapterId, { dataSaver: currentMangaState.dataSaver });
    $('#readerLoading').hidden = true;
    currentMangaState.totalPages = pagesData.total;
    $('#readerPageCounter').textContent = `Page ${initialPage} / ${pagesData.total}`;

    // Rendu en défilement vertical (Webtoon) avec états de chargement, retry et carte fin de chapitre
    const pagesFrag = document.createDocumentFragment();
    pagesData.pages.forEach((p, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'reader-page-wrap';
      wrap.dataset.page = idx + 1;

      const loader = document.createElement('div');
      loader.className = 'reader-page-loading';
      loader.innerHTML = '<div class="spinner"></div><p>Page ' + (idx + 1) + ' en cours de chargement...</p>';
      wrap.appendChild(loader);

      const img = document.createElement('img');
      img.className = 'reader-page-img';
      img.loading = idx < 3 ? 'eager' : 'lazy';
      img.dataset.page = idx + 1;
      img.alt = `Page ${idx + 1}`;
      img.hidden = true;

      const attachSrc = () => {
        img.src = p.url;
      };
      attachSrc();

      img.addEventListener('load', () => {
        img.hidden = false;
        loader.remove();
        errBox.remove();
      });

      const errBox = document.createElement('div');
      errBox.className = 'reader-page-error';
      errBox.hidden = true;
      errBox.innerHTML = '<p>⚠️ Impossible de charger la page ' + (idx + 1) + ' depuis MangaDex.</p><button type="button" class="btn-reader-nav">🔄 Réessayer</button>';
      errBox.querySelector('button').addEventListener('click', () => {
        errBox.hidden = true;
        loader.hidden = false;
        loader.innerHTML = '<div class="spinner"></div><p>Nouvelle tentative...</p>';
        attachSrc();
      });

      img.addEventListener('error', () => {
        loader.remove();
        errBox.hidden = false;
        announceReader('Erreur : impossible de charger la page ' + (idx + 1));
      });

      wrap.appendChild(img);
      wrap.appendChild(errBox);
      pagesFrag.appendChild(wrap);
    });

    // Déclenchement du préchargement des premières planches du chapitre suivant
    const hasNextChapter = currentMangaState.currentChapterIndex > 0;
    if (hasNextChapter) {
      const nextCh = currentMangaState.chapters[currentMangaState.currentChapterIndex - 1];
      prefetchNextChapterPages(nextCh.id, currentMangaState.dataSaver);
    }

    // Carte fin de chapitre : proposition d'ouvrir le chapitre suivant sans quitter le lecteur
    const endCard = document.createElement('div');
    endCard.className = 'reader-end-card';
    if (hasNextChapter) {
      const nextCh = currentMangaState.chapters[currentMangaState.currentChapterIndex - 1];
      endCard.innerHTML = '<p>🎉 Chapitre terminé !</p><button type="button" class="btn-primary" id="btnOpenNextChapter">📖 Ouvrir le chapitre suivant →</button>';
      pagesFrag.appendChild(endCard);
      setTimeout(() => {
        $('#btnOpenNextChapter')?.addEventListener('click', () => {
          if (currentMangaState.manga) openMangaReader(currentMangaState.manga.id, nextCh.id, 1);
        });
      }, 0);
    } else {
      endCard.innerHTML = '<p>🏁 Vous avez atteint le dernier chapitre disponible.</p>';
      pagesFrag.appendChild(endCard);
    }

    $('#readerPagesVertical').appendChild(pagesFrag);

    // Défilement automatique vers la page de reprise
    if (initialPage > 1) {
      setTimeout(() => {
        const targetImg = $(`#readerPagesVertical img[data-page="${initialPage}"]`);
        if (targetImg) targetImg.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }

    // Suivi de progression automatique lors du défilement
    const container = $('#readerContainer');
    let scrollTimeout = null;
    container.onscroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const imgs = $$('#readerPagesVertical img');
        const containerTop = container.getBoundingClientRect().top;
        for (const img of imgs) {
          const rect = img.getBoundingClientRect();
          if (rect.bottom >= containerTop + 100) {
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

    // Sauvegarde initiale du chapitre démarré
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

// Initialisation des contrôles du lecteur manga
document.addEventListener('DOMContentLoaded', () => {
  $('#btnCloseReader')?.addEventListener('click', () => {
    saveCurrentReaderProgress();
    const readerView = $('#viewMangaReader');
    if (readerView) readerView.hidden = true;
  });

  // Sauvegarde de secours quand l'onglet passe en arrière-plan ou se ferme
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentReaderProgress();
  });
  window.addEventListener('pagehide', () => saveCurrentReaderProgress());

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
    // Recharger le chapitre actuel avec le nouveau réglage
    const ch = currentMangaState.chapters[currentMangaState.currentChapterIndex];
    if (ch && currentMangaState.manga) {
      openMangaReader(currentMangaState.manga.id, ch.id, 1);
    }
  });

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
});


/* ==========================================================
   SAUVEGARDE DE PROGRESSION RENFORCÉE (lecteur manga)
   ========================================================== */
function getReaderVisiblePage() {
  const container = $('#readerContainer');
  if (!container) return 1;
  const containerTop = container.getBoundingClientRect().top;
  for (const wrap of $$('#readerPagesVertical .reader-page-wrap')) {
    const rect = wrap.getBoundingClientRect();
    if (rect.bottom >= containerTop + 100) {
      return parseInt(wrap.dataset.page, 10) || 1;
    }
  }
  return 1;
}

function saveCurrentReaderProgress() {
  const ch = currentMangaState.chapters[currentMangaState.currentChapterIndex];
  if (!currentMangaState.manga || !ch) return;
  saveMangaProgress(currentMangaState.manga.id, {
    chapterId: ch.id,
    chapterNumber: ch.chapter || '1',
    page: getReaderVisiblePage(),
    mangaTitle: currentMangaState.manga.title?.display || 'Manga'
  });
}


/* ==========================================================
   ACCESSIBILITÉ & PRÉCHARGEMENT AVEC ANNULATION (Lecteur)
   ========================================================== */
function announceReader(message) {
  const el = $('#readerLiveAnnouncer');
  if (el) {
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 50);
  }
}

let nextChapterPrefetchController = null;

function cancelNextChapterPrefetch() {
  if (nextChapterPrefetchController) {
    nextChapterPrefetchController.abort();
    nextChapterPrefetchController = null;
  }
}

async function prefetchNextChapterPages(nextChapterId, dataSaver) {
  cancelNextChapterPrefetch();
  const controller = new AbortController();
  nextChapterPrefetchController = controller;

  try {
    const data = await mangadexAdapter.getChapterPages(nextChapterId, { dataSaver });
    if (controller.signal.aborted) return;
    // Précharger en mémoire les 4 premières images
    const toPreload = data.pages.slice(0, 4);
    toPreload.forEach(p => {
      if (controller.signal.aborted) return;
      const img = new Image();
      img.src = p.url;
    });
  } catch (e) {
    // Ignorer les erreurs silencieuses de préchargement
  }
}

// Raccourcis clavier pour le lecteur manga
window.addEventListener('keydown', (e) => {
  const readerView = $('#viewMangaReader');
  if (!readerView || readerView.hidden) return;

  const container = $('#readerContainer') || window;
  const isScrollable = container === window ? document.documentElement : container;

  switch (e.key) {
    case 'Escape':
      saveCurrentReaderProgress();
      cancelNextChapterPrefetch();
      readerView.hidden = true;
      announceReader('Lecteur fermé');
      break;
    case 'ArrowRight':
    case ']': {
      const btnNext = $('#btnNextChapter');
      if (btnNext && !btnNext.disabled) {
        btnNext.click();
        announceReader('Chargement du chapitre suivant');
      }
      break;
    }
    case 'ArrowLeft':
    case '[': {
      const btnPrev = $('#btnPrevChapter');
      if (btnPrev && !btnPrev.disabled) {
        btnPrev.click();
        announceReader('Chargement du chapitre précédent');
      }
      break;
    }
    case 'ArrowDown':
    case 'j':
      isScrollable.scrollBy({ top: 300, behavior: 'smooth' });
      break;
    case 'ArrowUp':
    case 'k':
      isScrollable.scrollBy({ top: -300, behavior: 'smooth' });
      break;
    case 'f':
    case 'F':
      if (!document.fullscreenElement) {
        readerView.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
      break;
  }
});
