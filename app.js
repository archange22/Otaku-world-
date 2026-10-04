import { app, auth, db, storage } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import {
  ref as sRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

// ==========================================
// ÉTAT GLOBAL DE L'APPLICATION
// ==========================================
const state = {
  currentUser: null,
  userProfile: null,
  activeView: "home",
  activeCatalogType: "all",
  activeFilters: { genre: "", status: "", sort: "POPULARITY_DESC" },
  currentMedia: null,
  currentMangaDexId: null,
  currentChapters: [],
  currentChapterIndex: 0,
  currentChapterPages: [],
  currentMangaPage: 0,
  mangaReadingMode: "page", // "page" ou "webtoon"
  currentAnimeSeason: 1,
  currentAnimeEpisode: 1,
  currentAnimeLang: "VOSTFR",
  libraryTab: "continue",
  favorites: {},
  history: {},
  progress: {},
  watchlist: {},
  xpTimer: null
};

// ==========================================
// NOTIFICATIONS TOAST
// ==========================================
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ==========================================
// GESTION DU ROUTEUR & DES VUES
// ==========================================
function navigateTo(hash) {
  if (!hash) hash = "#home";
  const [route, queryString] = hash.replace("#", "").split("?");
  const params = new URLSearchParams(queryString || "");

  // Fermer le tiroir latéral et les popups
  document.getElementById("sideDrawer")?.classList.remove("open");
  document.getElementById("filterBottomSheet")?.classList.remove("open");

  // Masquer toutes les vues
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));

  // Mettre à jour les liens de navigation actifs
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => {
    const target = el.getAttribute("data-nav") || el.getAttribute("data-tab");
    if (target === route || (target && target.startsWith("catalog") && route === "catalog")) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });

  state.activeView = route;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (route === "home") {
    document.getElementById("viewHome")?.classList.add("active");
    renderHomeView();
  } else if (route === "catalog") {
    document.getElementById("viewCatalog")?.classList.add("active");
    if (params.get("type")) {
      state.activeCatalogType = params.get("type");
      updateCatalogTypeButtons();
    }
    loadCatalogMedia();
  } else if (route === "search") {
    document.getElementById("viewSearch")?.classList.add("active");
    const q = params.get("q");
    if (q) {
      document.getElementById("globalSearchInput").value = q;
      performGlobalSearch(q);
    }
  } else if (route === "detail") {
    document.getElementById("viewMediaDetail")?.classList.add("active");
    const id = params.get("id");
    const type = params.get("type") || "anime";
    if (id) loadMediaDetail(id, type);
  } else if (route === "player") {
    document.getElementById("viewVideoPlayer")?.classList.add("active");
    startAnimePlayer(params.get("id"), params.get("season") || 1, params.get("ep") || 1);
  } else if (route === "reader") {
    document.getElementById("viewMangaReader")?.classList.add("active");
    startMangaReader(params.get("id"), params.get("ch") || null);
  } else if (route === "library") {
    document.getElementById("viewLibrary")?.classList.add("active");
    const tab = params.get("tab") || "continue";
    state.libraryTab = tab;
    renderLibraryView();
  } else if (route === "profile") {
    document.getElementById("viewProfile")?.classList.add("active");
    renderProfileView();
  } else if (route === "admin") {
    document.getElementById("viewAdmin")?.classList.add("active");
    renderAdminView();
  }
}

window.addEventListener("hashchange", () => navigateTo(window.location.hash));

// ==========================================
// API ANILIST (GraphQL)
// ==========================================
async function fetchAniList(query, variables = {}) {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: json.dumps({ query, variables }) if False else JSON.stringify({ query, variables })
    });
    const data = await res.json();
    return data?.data || null;
  } catch (err) {
    console.error("AniList Error:", err);
    return null;
  }
}

// Requêtes AniList
const QUERY_HOME_COLLECTIONS = `
query {
  trending: Page(page: 1, perPage: 8) {
    media(sort: TRENDING_DESC, isAdult: false, type: ANIME) {
      id title { romaji english native } coverImage { large extraLarge } bannerImage
      description averageScore seasonYear episodes format genres
    }
  }
  latest: Page(page: 1, perPage: 8) {
    media(sort: START_DATE_DESC, isAdult: false, type: ANIME, status: RELEASING) {
      id title { romaji english } coverImage { large } format averageScore episodes
    }
  }
  popularAnime: Page(page: 1, perPage: 8) {
    media(sort: POPULARITY_DESC, isAdult: false, type: ANIME) {
      id title { romaji english } coverImage { large } format averageScore episodes
    }
  }
  popularManga: Page(page: 1, perPage: 8) {
    media(sort: POPULARITY_DESC, isAdult: false, type: MANGA) {
      id title { romaji english } coverImage { large } format averageScore chapters
    }
  }
}
`;

const QUERY_CATALOG = `
query ($page: Int, $type: MediaType, $sort: [MediaSort], $genre: String, $status: MediaStatus, $search: String) {
  Page(page: $page, perPage: 18) {
    media(type: $type, sort: $sort, genre: $genre, status: $status, search: $search, isAdult: false) {
      id title { romaji english } coverImage { large } bannerImage
      format averageScore seasonYear status episodes chapters genres
    }
  }
}
`;

const QUERY_DETAIL = `
query ($id: Int) {
  Media(id: $id, isAdult: false) {
    id title { romaji english native }
    coverImage { extraLarge large } bannerImage
    description averageScore seasonYear status episodes chapters
    format genres duration trailer { id site }
  }
}
`;

// ==========================================
// 1. VUE ACCUEIL
// ==========================================
async function renderHomeView() {
  renderContinueSection();
  const data = await fetchAniList(QUERY_HOME_COLLECTIONS);
  if (!data) return;

  // Hero Banner
  const featured = data.trending?.media?.[0];
  if (featured) {
    const banner = document.getElementById("heroBanner");
    const bannerImg = featured.bannerImage || featured.coverImage.extraLarge;
    const title = featured.title.english || featured.title.romaji;
    banner.style.backgroundImage = `url('${bannerImg}')`;
    banner.innerHTML = `
      <div class="hero-content">
        <span class="hero-tag">🔥 N°1 Tendances</span>
        <h1 class="hero-title">${title}</h1>
        <p class="hero-desc">${(featured.description || "").replace(/<[^>]*>?/gm, '')}</p>
        <div class="hero-actions">
          <a href="#player?id=${featured.id}&season=1&ep=1" class="btn btn-primary btn-lg">▶ Regarder l'épisode 1</a>
          <a href="#detail?id=${featured.id}&type=anime" class="btn btn-secondary btn-lg">Fiche détaillée</a>
        </div>
      </div>
    `;
  }

  // Grilles de la page d'accueil
  renderCardRow("trendingGrid", data.trending?.media || [], "anime");
  renderCardRow("latestGrid", data.latest?.media || [], "anime");
  renderCardRow("popularAnimeGrid", data.popularAnime?.media || [], "anime");
  renderCardRow("popularMangaGrid", data.popularManga?.media || [], "manga");

  // Webtoons (requête AniList format MANGA + tag Webtoon)
  const webtoonsData = await fetchAniList(`
    query {
      Page(page: 1, perPage: 8) {
        media(type: MANGA, sort: POPULARITY_DESC, countryOfOrigin: "KR", isAdult: false) {
          id title { romaji english } coverImage { large } format averageScore
        }
      }
    }
  `);
  if (webtoonsData?.Page?.media) {
    renderCardRow("popularWebtoonGrid", webtoonsData.Page.media, "webtoon");
  }

  // Recommandés pour toi (basé sur l'historique)
  renderRecommendedSection();
}

function renderCardRow(containerId, list, defaultType = "anime") {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding: 10px;">Aucun titre disponible.</p>`;
    return;
  }
  container.innerHTML = list.map(item => {
    const title = item.title?.english || item.title?.romaji || "Sans titre";
    const score = item.averageScore ? `${(item.averageScore / 10).toFixed(1)} ★` : "";
    const type = item.format === "MANGA" ? "manga" : defaultType;
    return `
      <div class="media-card" onclick="window.location.hash = '#detail?id=${item.id}&type=${type}'">
        <img class="media-card-poster" src="${item.coverImage?.large || item.coverImage?.extraLarge}" alt="${title}" loading="lazy">
        ${score ? `<span class="media-card-badge">${score}</span>` : ""}
        <div class="media-card-body">
          <h4 class="media-card-title">${title}</h4>
          <div class="media-card-meta">
            <span>${item.format || type.toUpperCase()}</span>
            <span>${item.episodes ? `${item.episodes} eps` : (item.chapters ? `${item.chapters} ch` : "")}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderContinueSection() {
  const sec = document.getElementById("sectionContinue");
  const container = document.getElementById("continueList");
  if (!sec || !container) return;

  const entries = Object.entries(state.progress);
  if (entries.length === 0) {
    sec.style.display = "none";
    return;
  }
  sec.style.display = "block";
  container.innerHTML = entries.slice(0, 6).map(([id, p]) => {
    const isManga = p.type === "manga" || p.chapter != null;
    const sub = isManga ? `Chapitre ${p.chapter || 1} • Page ${p.page || 1}` : `Saison ${p.season || 1} • EP ${p.episode || 1}`;
    const percent = p.progressPercent || 25;
    const resumeLink = isManga ? `#reader?id=${id}&ch=${p.chapter || 1}` : `#player?id=${id}&season=${p.season || 1}&ep=${p.episode || 1}`;

    return `
      <div class="continue-card">
        <img class="continue-poster" src="${p.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200'}" alt="${p.title || ''}">
        <div class="continue-info">
          <div>
            <h4 class="continue-title">${p.title || 'En cours'}</h4>
            <span class="continue-ep">${sub}</span>
            <div class="continue-progress-bar">
              <div class="continue-progress-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
          <a href="${resumeLink}" class="btn btn-primary continue-btn">Reprendre ▶</a>
        </div>
      </div>
    `;
  }).join("");
}

function renderRecommendedSection() {
  const sec = document.getElementById("sectionRecommended");
  const container = document.getElementById("recommendedGrid");
  if (!sec || !container) return;

  const historyEntries = Object.values(state.history);
  if (historyEntries.length === 0) {
    sec.style.display = "none";
    return;
  }
  // Afficher si l'utilisateur a un historique
  sec.style.display = "block";
}

// ==========================================
// 2. VUE CATALOGUE & FILTRES
// ==========================================
let catalogPage = 1;

async function loadCatalogMedia(append = false) {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;
  if (!append) {
    catalogPage = 1;
    grid.innerHTML = `<div class="spinner" style="grid-column: 1/-1; margin: 40px auto;"></div>`;
  }

  let aniListType = "ANIME";
  if (state.activeCatalogType === "manga" || state.activeCatalogType === "webtoon") {
    aniListType = "MANGA";
  }

  const variables = {
    page: catalogPage,
    type: state.activeCatalogType === "all" ? undefined : aniListType,
    sort: [state.activeFilters.sort || "POPULARITY_DESC"],
    genre: state.activeFilters.genre || undefined,
    status: state.activeFilters.status || undefined,
    search: document.getElementById("catalogSearchInput")?.value?.trim() || undefined
  };

  const data = await fetchAniList(QUERY_CATALOG, variables);
  const items = data?.Page?.media || [];

  if (!append) grid.innerHTML = "";

  if (items.length === 0 && !append) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>Aucun résultat trouvé</h3><p>Essayez de modifier vos filtres.</p></div>`;
    return;
  }

  const html = items.map(item => {
    const title = item.title?.english || item.title?.romaji || "Sans titre";
    const score = item.averageScore ? `${(item.averageScore / 10).toFixed(1)} ★` : "";
    const type = item.format === "MANGA" ? "manga" : (state.activeCatalogType === "all" ? "anime" : state.activeCatalogType);
    return `
      <div class="media-card" onclick="window.location.hash = '#detail?id=${item.id}&type=${type}'">
        <img class="media-card-poster" src="${item.coverImage?.large}" alt="${title}" loading="lazy">
        ${score ? `<span class="media-card-badge">${score}</span>` : ""}
        <div class="media-card-body">
          <h4 class="media-card-title">${title}</h4>
          <div class="media-card-meta">
            <span>${item.seasonYear || item.format || ''}</span>
            <span>${item.episodes ? `${item.episodes} eps` : ''}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.insertAdjacentHTML("beforeend", html);
}

function updateCatalogTypeButtons() {
  document.querySelectorAll(".type-segmented-control .seg-btn").forEach(btn => {
    if (btn.getAttribute("data-type") === state.activeCatalogType) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// ==========================================
// 3. RECHERCHE GLOBALE INSTANTANÉE
// ==========================================
let searchDebounceTimer = null;

async function performGlobalSearch(query) {
  const resultsArea = document.getElementById("searchResultsArea");
  if (!resultsArea) return;
  if (!query || query.trim().length < 2) {
    resultsArea.innerHTML = `
      <div class="search-placeholder">
        <span class="placeholder-icon">🔍</span>
        <p>Tapez au moins 2 caractères pour rechercher.</p>
      </div>
    `;
    return;
  }

  resultsArea.innerHTML = `<div class="spinner" style="margin: 40px auto;"></div>`;

  // Recherche conjointe AniList (Anime & Manga) + MangaDex
  const data = await fetchAniList(`
    query ($search: String) {
      anime: Page(page: 1, perPage: 8) {
        media(search: $search, type: ANIME, isAdult: false) {
          id title { romaji english } coverImage { large } averageScore format seasonYear episodes
        }
      }
      manga: Page(page: 1, perPage: 8) {
        media(search: $search, type: MANGA, isAdult: false) {
          id title { romaji english } coverImage { large } averageScore format chapters
        }
      }
    }
  `, { search: query });

  const animes = data?.anime?.media || [];
  const mangas = data?.manga?.media || [];

  if (animes.length === 0 && mangas.length === 0) {
    resultsArea.innerHTML = `<div class="empty-state"><h3>Aucun résultat pour "${query}"</h3><p>Vérifiez l'orthographe du titre.</p></div>`;
    return;
  }

  let html = "";
  if (animes.length > 0) {
    html += `
      <div class="search-section-block">
        <h3 class="section-title">📺 Anime (${animes.length})</h3>
        <div class="media-grid" style="margin-top: 12px;">
          ${animes.map(i => renderMediaCardHtml(i, "anime")).join("")}
        </div>
      </div>
    `;
  }
  if (mangas.length > 0) {
    html += `
      <div class="search-section-block" style="margin-top: 24px;">
        <h3 class="section-title">📖 Manga & Webtoon (${mangas.length})</h3>
        <div class="media-grid" style="margin-top: 12px;">
          ${mangas.map(i => renderMediaCardHtml(i, "manga")).join("")}
        </div>
      </div>
    `;
  }
  resultsArea.innerHTML = html;
}

function renderMediaCardHtml(item, type) {
  const title = item.title?.english || item.title?.romaji || "Sans titre";
  const score = item.averageScore ? `${(item.averageScore / 10).toFixed(1)} ★` : "";
  return `
    <div class="media-card" onclick="window.location.hash = '#detail?id=${item.id}&type=${type}'">
      <img class="media-card-poster" src="${item.coverImage?.large}" alt="${title}" loading="lazy">
      ${score ? `<span class="media-card-badge">${score}</span>` : ""}
      <div class="media-card-body">
        <h4 class="media-card-title">${title}</h4>
        <div class="media-card-meta">
          <span>${item.format || type.toUpperCase()}</span>
          <span>${item.episodes ? `${item.episodes} eps` : (item.chapters ? `${item.chapters} ch` : "")}</span>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 4. FICHE DÉTAILLÉE (ANIME / MANGA)
// ==========================================
async function loadMediaDetail(id, type = "anime") {
  const container = document.getElementById("mediaDetailContent");
  const backdrop = document.getElementById("mediaDetailBackdrop");
  if (!container) return;

  container.innerHTML = `<div class="spinner" style="margin: 60px auto;"></div>`;

  const data = await fetchAniList(QUERY_DETAIL, { id: parseInt(id) });
  const media = data?.Media;
  if (!media) {
    container.innerHTML = `<div class="empty-state"><h3>Fiche introuvable</h3></div>`;
    return;
  }
  state.currentMedia = { ...media, type };

  // Sauvegarder dans l'historique de l'utilisateur
  recordHistory(media, type);

  // Backdrop
  const bgImg = media.bannerImage || media.coverImage.extraLarge;
  if (backdrop) backdrop.style.backgroundImage = `url('${bgImg}')`;

  const title = media.title.english || media.title.romaji;
  const altTitle = media.title.native || media.title.romaji;
  const score = media.averageScore ? `${(media.averageScore / 10).toFixed(1)} / 10 ★` : "Non noté";
  const isFav = !!state.favorites[id];
  const isWatch = !!state.watchlist[id];
  const totalEpisodes = media.episodes || 12;

  // Calcul du nombre de saisons approximatif
  const seasonCount = Math.max(1, Math.min(6, Math.ceil(totalEpisodes / 12)));

  let actionButtons = "";
  if (type === "anime") {
    actionButtons = `
      <a href="#player?id=${media.id}&season=1&ep=1" class="btn btn-primary btn-lg">▶ Regarder l'épisode 1</a>
    `;
  } else {
    actionButtons = `
      <a href="#reader?id=${media.id}&ch=1" class="btn btn-primary btn-lg">📖 Lire le manga</a>
    `;
  }

  actionButtons += `
    <button id="btnToggleWatchlist" class="btn btn-secondary ${isWatch ? 'active' : ''}">
      ${isWatch ? '✓ Dans ma liste' : '＋ Ma liste'}
    </button>
    <button id="btnToggleFavorite" class="btn btn-secondary ${isFav ? 'active' : ''}">
      ${isFav ? '❤️ Favori' : '♡ Favori'}
    </button>
  `;

  let seasonsHtml = "";
  if (type === "anime") {
    seasonsHtml = `
      <div class="detail-episodes-box">
        <div class="episodes-header-bar">
          <h3>Saisons disponibles</h3>
          <div class="lang-selector-group">
            <button class="lang-pill active" onclick="setMediaLang('VOSTFR')">VOSTFR</button>
            <button class="lang-pill" onclick="setMediaLang('VF')">VF</button>
            <button class="lang-pill" onclick="setMediaLang('VO')">VO</button>
          </div>
        </div>

        <div class="season-tabs">
          ${Array.from({ length: seasonCount }, (_, i) => `
            <button class="season-tab ${i === 0 ? 'active' : ''}" onclick="switchSeasonTab(${i + 1}, ${totalEpisodes})">
              Saison ${i + 1}
            </button>
          `).join("")}
        </div>

        <div id="seasonEpisodesGrid" class="episodes-grid-large">
          ${renderSeasonEpisodes(1, Math.min(totalEpisodes, 12), media.id)}
        </div>
      </div>
    `;
  } else {
    seasonsHtml = `
      <div class="detail-episodes-box">
        <div class="episodes-header-bar">
          <h3>Chapitres MangaDex</h3>
          <span class="section-tag" id="mangaLangTag">🇫🇷 Traduction FR / EN</span>
        </div>
        <div id="mangaChaptersDetailList" style="margin-top: 12px;">
          <div class="spinner"></div>
        </div>
      </div>
    `;
    // Charger la liste des chapitres MangaDex
    fetchMangaDexChaptersForDetail(title, media.id);
  }

  container.innerHTML = `
    <div class="detail-hero">
      <img src="${media.coverImage.extraLarge || media.coverImage.large}" class="detail-poster" alt="${title}">
      <div class="detail-header-info">
        <h1 class="detail-title">${title}</h1>
        <p class="detail-alt-title">${altTitle}</p>
        <div class="detail-badges">
          <span class="detail-badge score">${score}</span>
          <span class="detail-badge">${media.seasonYear || ''}</span>
          <span class="detail-badge">${media.status || ''}</span>
          <span class="detail-badge">${media.format || type.toUpperCase()}</span>
          ${(media.genres || []).map(g => `<span class="detail-badge">${g}</span>`).join("")}
        </div>
        <div class="detail-actions-row">
          ${actionButtons}
        </div>
      </div>
    </div>

    <div class="detail-synopsis-box">
      <h3>Synopsis</h3>
      <p class="detail-synopsis-text">${(media.description || "Aucune description fournie.").replace(/<[^>]*>?/gm, '')}</p>
    </div>

    ${seasonsHtml}

    <!-- Commentaires synchronisés Firebase -->
    <div class="detail-synopsis-box">
      <h3>Commentaires de la communauté</h3>
      <div id="commentsArea">
        <div id="commentsList" style="margin-bottom: 16px;"></div>
        <div class="comment-input-box" style="display: flex; gap: 8px;">
          <input type="text" id="commentTextInput" class="input-field" placeholder="Donnez votre avis...">
          <button id="btnSendComment" class="btn btn-primary">Publier</button>
        </div>
      </div>
    </div>
  `;

  // Attach button events
  document.getElementById("btnToggleFavorite")?.addEventListener("click", () => toggleFavorite(media, type));
  document.getElementById("btnToggleWatchlist")?.addEventListener("click", () => toggleWatchlist(media, type));
  document.getElementById("btnSendComment")?.addEventListener("click", () => postComment(media.id));

  // Load comments
  loadComments(media.id);
}

function renderSeasonEpisodes(season, epCount, mediaId) {
  let html = "";
  for (let ep = 1; ep <= epCount; ep++) {
    const isWatched = state.progress[mediaId]?.episode > ep;
    const isCurrent = state.progress[mediaId]?.episode === ep;
    const statusDot = isWatched ? `<span class="ep-status-dot"></span>` : "";
    html += `
      <a href="#player?id=${mediaId}&season=${season}&ep=${ep}" class="ep-btn ${isCurrent ? 'active' : ''}">
        ${statusDot}
        <span>EP ${ep < 10 ? '0' + ep : ep}</span>
        <span class="ep-btn-sub">Épisode ${ep}</span>
      </a>
    `;
  }
  return html;
}

window.switchSeasonTab = function(season, totalEps) {
  document.querySelectorAll(".season-tab").forEach((tab, i) => {
    if (i + 1 === season) tab.classList.add("active");
    else tab.classList.remove("active");
  });
  const grid = document.getElementById("seasonEpisodesGrid");
  if (grid && state.currentMedia) {
    grid.innerHTML = renderSeasonEpisodes(season, Math.min(totalEps, 12), state.currentMedia.id);
  }
};

window.setMediaLang = function(lang) {
  state.currentAnimeLang = lang;
  document.querySelectorAll(".lang-selector-group .lang-pill").forEach(p => {
    if (p.textContent === lang) p.classList.add("active");
    else p.classList.remove("active");
  });
  showToast(`Version ${lang} sélectionnée`);
};

// ==========================================
// 5. LECTEUR VIDÉO (ANIME)
// ==========================================
function startAnimePlayer(mediaId, season = 1, episode = 1) {
  const container = document.getElementById("playerContainer");
  const titleEl = document.getElementById("playerAnimeTitle");
  const subEl = document.getElementById("playerEpisodeSubtitle");
  const badgeEl = document.getElementById("playerCurrentBadge");
  const prevBtn = document.getElementById("btnPrevEpisode");
  const nextBtn = document.getElementById("btnNextEpisode");

  season = parseInt(season);
  episode = parseInt(episode);

  const media = state.currentMedia;
  const title = media?.title?.english || media?.title?.romaji || "Anime";
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = `Saison ${season} • Épisode ${episode} (${state.currentAnimeLang})`;
  if (badgeEl) badgeEl.textContent = `EP ${episode}`;

  // Boutons précédent / suivant
  if (prevBtn) {
    prevBtn.disabled = episode <= 1;
    prevBtn.onclick = () => window.location.hash = `#player?id=${mediaId}&season=${season}&ep=${episode - 1}`;
  }
  if (nextBtn) {
    nextBtn.onclick = () => window.location.hash = `#player?id=${mediaId}&season=${season}&ep=${episode + 1}`;
  }

  // Intégration du lecteur autorisé (Bande annonce officielle YouTube ou source vidéo de remplacement propre)
  let videoEmbed = "";
  if (media?.trailer?.site === "youtube" && media?.trailer?.id) {
    videoEmbed = `
      <iframe src="https://www.youtube.com/embed/${media.trailer.id}?autoplay=1&rel=0&modestbranding=1" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen></iframe>
    `;
  } else {
    // Lecteur HTML5 officiel de démonstration autorisé
    videoEmbed = `
      <video controls autoplay style="width: 100%; height: 100%; background: #000;">
        <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
        Votre navigateur ne supporte pas la balise vidéo.
      </video>
    `;
  }
  if (container) container.innerHTML = videoEmbed;

  // Enregistrer la progression dans Firebase
  saveProgress(mediaId, {
    season,
    episode,
    type: "anime",
    title,
    cover: media?.coverImage?.large,
    progressPercent: Math.min(100, Math.round((episode / (media?.episodes || 12)) * 100))
  });

  // Activer le gain d'XP (1 XP par minute)
  startActiveXpTimer();
}

// ==========================================
// 6. LECTEUR MANGA RÉEL (MANGADEX API)
// ==========================================
async function fetchMangaDexChaptersForDetail(title, aniListId) {
  const container = document.getElementById("mangaChaptersDetailList");
  if (!container) return;

  try {
    // 1. Recherche du manga sur MangaDex
    const searchRes = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=1`);
    const searchData = await searchRes.json();
    const manga = searchData?.data?.[0];

    if (!manga) {
      container.innerHTML = `<p class="text-muted">Aucun chapitre disponible actuellement sur MangaDex.</p>`;
      return;
    }
    state.currentMangaDexId = manga.id;

    // 2. Récupération des chapitres en français et anglais
    const feedRes = await fetch(`https://api.mangadex.org/manga/${manga.id}/feed?translatedLanguage[]=fr&translatedLanguage[]=en&order[chapter]=asc&limit=100`);
    const feedData = await feedRes.json();
    const chapters = feedData?.data || [];

    if (chapters.length === 0) {
      container.innerHTML = `<p class="text-muted">Aucun chapitre traduit trouvé pour ce manga.</p>`;
      return;
    }

    state.currentChapters = chapters;

    container.innerHTML = `
      <div class="episodes-grid-large">
        ${chapters.map((ch, idx) => {
          const num = ch.attributes?.chapter || idx + 1;
          const lang = ch.attributes?.translatedLanguage === "fr" ? "🇫🇷 FR" : "🇬🇧 EN";
          return `
            <a href="#reader?id=${aniListId}&ch=${num}&mdChId=${ch.id}" class="ep-btn">
              <span>CH ${num}</span>
              <span class="ep-btn-sub">${lang}</span>
            </a>
          `;
        }).join("")}
      </div>
    `;
  } catch (err) {
    console.error("MangaDex detail error:", err);
    container.innerHTML = `<p class="text-muted">Impossible de contacter le serveur MangaDex.</p>`;
  }
}

async function startMangaReader(mediaId, chapterNum) {
  const viewport = document.getElementById("mangaViewport");
  const loader = document.getElementById("mangaPageLoader");
  const pageContainer = document.getElementById("mangaPageContainer");
  const titleEl = document.getElementById("readerMangaTitle");
  const badgeEl = document.getElementById("readerChapterBadge");
  const selectEl = document.getElementById("readerChapterSelect");

  if (loader) loader.style.display = "flex";
  if (pageContainer) pageContainer.innerHTML = "";

  const title = state.currentMedia?.title?.english || state.currentMedia?.title?.romaji || "Manga";
  if (titleEl) titleEl.textContent = title;
  if (badgeEl) badgeEl.textContent = `Chapitre ${chapterNum || 1}`;

  try {
    let mangaId = state.currentMangaDexId;
    if (!mangaId) {
      const searchRes = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=1`);
      const searchData = await searchRes.json();
      mangaId = searchData?.data?.[0]?.id;
      state.currentMangaDexId = mangaId;
    }

    if (!mangaId) throw new Error("Manga introuvable sur MangaDex");

    // Trouver le chapitre
    const feedRes = await fetch(`https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=fr&translatedLanguage[]=en&order[chapter]=asc&limit=100`);
    const feedData = await feedRes.json();
    const chapters = feedData?.data || [];
    state.currentChapters = chapters;

    // Remplir le dropdown
    if (selectEl) {
      selectEl.innerHTML = chapters.map((c, i) => `
        <option value="${c.id}" ${c.attributes?.chapter == chapterNum ? 'selected' : ''}>
          Ch. ${c.attributes?.chapter || i + 1} (${c.attributes?.translatedLanguage?.toUpperCase()})
        </option>
      `).join("");
      selectEl.onchange = (e) => loadMangaChapterPages(e.target.value);
    }

    const targetChapter = chapters.find(c => c.attributes?.chapter == chapterNum) || chapters[0];
    if (targetChapter) {
      await loadMangaChapterPages(targetChapter.id);
    }
  } catch (err) {
    console.error("MangaDex Reader Error:", err);
    if (loader) loader.innerHTML = `<p class="text-danger">Erreur de chargement du manga : ${err.message}</p>`;
  }

  // Activer XP de lecture
  startActiveXpTimer();
}

async function loadMangaChapterPages(chapterId) {
  const loader = document.getElementById("mangaPageLoader");
  const pageContainer = document.getElementById("mangaPageContainer");
  const curPageEl = document.getElementById("mangaCurrentPage");
  const totalPagesEl = document.getElementById("mangaTotalPages");

  if (loader) loader.style.display = "flex";
  if (pageContainer) pageContainer.innerHTML = "";

  try {
    const res = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`);
    const data = await res.json();
    const baseUrl = data.baseUrl;
    const hash = data.chapter.hash;
    const files = data.chapter.data;

    state.currentChapterPages = files.map(f => `${baseUrl}/data/${hash}/${f}`);
    state.currentMangaPage = 0;

    if (loader) loader.style.display = "none";
    if (curPageEl) curPageEl.textContent = "1";
    if (totalPagesEl) totalPagesEl.textContent = files.length;

    renderMangaPage();

    // Progression Firebase
    if (state.currentMedia) {
      saveProgress(state.currentMedia.id, {
        chapter: 1,
        page: 1,
        type: "manga",
        title: state.currentMedia.title?.english || state.currentMedia.title?.romaji,
        cover: state.currentMedia.coverImage?.large,
        progressPercent: Math.round((1 / files.length) * 100)
      });
    }
  } catch (err) {
    if (loader) loader.innerHTML = `<p class="text-danger">Impossible de récupérer les pages de MangaDex.</p>`;
  }
}

function renderMangaPage() {
  const pageContainer = document.getElementById("mangaPageContainer");
  const curPageEl = document.getElementById("mangaCurrentPage");
  if (!pageContainer) return;

  const pages = state.currentChapterPages;
  if (pages.length === 0) return;

  if (state.mangaReadingMode === "page") {
    const pageUrl = pages[state.currentMangaPage];
    pageContainer.innerHTML = `
      <img src="${pageUrl}" class="manga-page-img" alt="Page ${state.currentMangaPage + 1}">
    `;
    if (curPageEl) curPageEl.textContent = state.currentMangaPage + 1;
  } else {
    // Mode Webtoon (défilement vertical)
    pageContainer.innerHTML = pages.map((url, i) => `
      <img src="${url}" class="manga-page-img" loading="lazy" alt="Page ${i + 1}">
    `).join("");
  }
}

// Navigation pages manga
document.getElementById("btnMangaPrevPage")?.addEventListener("click", () => {
  if (state.currentMangaPage > 0) {
    state.currentMangaPage--;
    renderMangaPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

document.getElementById("btnMangaNextPage")?.addEventListener("click", () => {
  if (state.currentMangaPage < state.currentChapterPages.length - 1) {
    state.currentMangaPage++;
    renderMangaPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

document.getElementById("btnToggleReaderMode")?.addEventListener("click", () => {
  state.mangaReadingMode = state.mangaReadingMode === "page" ? "webtoon" : "page";
  const label = document.getElementById("readerModeLabel");
  const viewport = document.getElementById("mangaViewport");
  const controls = document.getElementById("mangaPageControls");
  if (label) label.textContent = state.mangaReadingMode === "page" ? "Mode Page" : "Mode Webtoon";
  if (viewport) {
    viewport.className = `manga-viewport mode-${state.mangaReadingMode}`;
  }
  if (controls) {
    controls.style.display = state.mangaReadingMode === "page" ? "flex" : "none";
  }
  renderMangaPage();
});

// ==========================================
// 7. MA BIBLIOTHÈQUE
// ==========================================
function renderLibraryView() {
  const grid = document.getElementById("libraryContentGrid");
  const empty = document.getElementById("libraryEmptyState");
  if (!grid || !empty) return;

  // Mise à jour des compteurs
  document.getElementById("countContinue").textContent = Object.keys(state.progress).length;
  document.getElementById("countFavorites").textContent = Object.keys(state.favorites).length;
  document.getElementById("countWatchlist").textContent = Object.keys(state.watchlist).length;
  document.getElementById("countHistory").textContent = Object.keys(state.history).length;

  document.querySelectorAll(".lib-tab").forEach(tab => {
    if (tab.getAttribute("data-tab") === state.libraryTab) tab.classList.add("active");
    else tab.classList.remove("active");
  });

  let items = {};
  if (state.libraryTab === "continue") items = state.progress;
  else if (state.libraryTab === "favorites") items = state.favorites;
  else if (state.libraryTab === "watchlist") items = state.watchlist;
  else if (state.libraryTab === "history") items = state.history;

  const entries = Object.entries(items);
  if (entries.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  grid.innerHTML = entries.map(([id, item]) => {
    const isManga = item.type === "manga";
    return `
      <div class="media-card" onclick="window.location.hash = '#detail?id=${id}&type=${isManga ? 'manga' : 'anime'}'">
        <img class="media-card-poster" src="${item.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200'}" alt="${item.title || ''}">
        <div class="media-card-body">
          <h4 class="media-card-title">${item.title || 'Sans titre'}</h4>
          <div class="media-card-meta">
            <span>${item.type?.toUpperCase() || 'ANIME'}</span>
            <span>${item.episode ? `EP ${item.episode}` : ''}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 8. PROFIL, XP & BADGES
// ==========================================
function renderProfileView() {
  const loggedView = document.getElementById("profileLoggedView");
  const guestView = document.getElementById("profileGuestView");

  if (!state.currentUser) {
    if (loggedView) loggedView.style.display = "none";
    if (guestView) guestView.style.display = "block";
    return;
  }

  if (loggedView) loggedView.style.display = "block";
  if (guestView) guestView.style.display = "none";

  const p = state.userProfile || {};
  document.getElementById("profileUsername").textContent = p.username || state.currentUser.displayName || "Otaku";
  document.getElementById("profileEmail").textContent = state.currentUser.email;
  
  if (p.avatar) {
    document.getElementById("profileAvatarImg").src = p.avatar;
  }

  // Rôle
  const roleBadge = document.getElementById("profileRoleBadge");
  if (roleBadge) {
    const role = (p.role || "member").toLowerCase();
    roleBadge.textContent = role.toUpperCase();
    roleBadge.className = `role-badge role-${role}`;
  }

  // XP & Niveau
  const xp = p.xp || 0;
  const level = Math.floor(xp / 100) + 1;
  const currentLevelXp = xp % 100;
  document.getElementById("profileLevel").textContent = level;
  document.getElementById("profileCurrentXp").textContent = currentLevelXp;
  document.getElementById("profileNextXp").textContent = 100;
  document.getElementById("profileXpBar").style.width = `${currentLevelXp}%`;

  // Stats
  document.getElementById("statWatchTime").textContent = `${Math.floor((p.watchMinutes || 0) / 60)} h`;
  document.getElementById("statReadTime").textContent = `${Math.floor((p.readMinutes || 0) / 60)} h`;
  document.getElementById("statAnimeDone").textContent = p.animeDone || 0;
  document.getElementById("statMangaDone").textContent = p.mangaDone || 0;

  // Badges & Paliers
  const badgesContainer = document.getElementById("badgesContainer");
  if (badgesContainer) {
    const badges = [
      { id: "b1", emoji: "🌱", name: "Premier Pas", desc: "10 min passées", unlocked: (p.watchMinutes || 0) + (p.readMinutes || 0) >= 10 },
      { id: "b2", emoji: "🥉", name: "Apprenti Otaku", desc: "1 heure passée", unlocked: (p.watchMinutes || 0) + (p.readMinutes || 0) >= 60 },
      { id: "b3", emoji: "🥈", name: "Otaku Confirmé", desc: "5 heures passées", unlocked: (p.watchMinutes || 0) + (p.readMinutes || 0) >= 300 },
      { id: "b4", emoji: "🥇", name: "Marathonien", desc: "10 heures passées", unlocked: (p.watchMinutes || 0) + (p.readMinutes || 0) >= 600 },
      { id: "b5", emoji: "👑", name: "Maître Suprême", desc: "25 heures passées", unlocked: (p.watchMinutes || 0) + (p.readMinutes || 0) >= 1500 }
    ];

    badgesContainer.innerHTML = badges.map(b => `
      <div class="badge-item ${b.unlocked ? '' : 'locked'}">
        <span class="badge-emoji">${b.emoji}</span>
        <span class="badge-name">${b.name}</span>
        <span class="badge-desc">${b.desc}</span>
      </div>
    `).join("");
  }
}

// Upload Avatar Firebase Storage
document.getElementById("avatarUploadInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file || !state.currentUser) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("L'image ne doit pas dépasser 2 Mo.");
    return;
  }

  showToast("Téléversement de l'avatar...");
  try {
    const avatarRef = sRef(storage, `avatars/${state.currentUser.uid}/profile.jpg`);
    await uploadBytes(avatarRef, file);
    const url = await getDownloadURL(avatarRef);

    await update(ref(db, `users/${state.currentUser.uid}`), { avatar: url });
    document.getElementById("profileAvatarImg").src = url;
    showToast("Photo de profil mise à jour !");
  } catch (err) {
    console.error("Storage error:", err);
    showToast("Erreur lors de l'upload de l'avatar.");
  }
});

// Gain automatique d'XP (1 XP par minute)
function startActiveXpTimer() {
  if (state.xpTimer) clearInterval(state.xpTimer);
  state.xpTimer = setInterval(() => {
    if (!state.currentUser) return;
    const uid = state.currentUser.uid;
    const isManga = state.activeView === "reader";

    const userRef = ref(db, `users/${uid}`);
    get(userRef).then(snapshot => {
      const current = snapshot.val() || {};
      const newXp = (current.xp || 0) + 1;
      const updates = { xp: newXp };
      if (isManga) updates.readMinutes = (current.readMinutes || 0) + 1;
      else updates.watchMinutes = (current.watchMinutes || 0) + 1;

      update(userRef, updates);
    });
  }, 60000); // 1 minute
}

// ==========================================
// 9. DASHBOARD ADMIN / OWNER
// ==========================================
async function renderAdminView() {
  if (!state.currentUser) {
    window.location.hash = "#home";
    return;
  }
  const role = (state.userProfile?.role || "").toLowerCase();
  if (!["owner", "admin", "moderator"].includes(role)) {
    showToast("Accès réservé aux administrateurs.");
    window.location.hash = "#home";
    return;
  }

  const isOwner = role === "owner";

  // Récupérer la liste des utilisateurs depuis Firebase Realtime Database
  const usersSnap = await get(ref(db, "users"));
  const users = usersSnap.val() || {};
  const userEntries = Object.entries(users);

  document.getElementById("admTotalUsers").textContent = userEntries.length;
  let totalXp = 0;
  userEntries.forEach(([_, u]) => totalXp += (u.xp || 0));
  document.getElementById("admTotalXp").textContent = `${totalXp} XP`;

  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;

  tbody.innerHTML = userEntries.map(([uid, u]) => `
    <tr>
      <td><strong>${u.username || 'Utilisateur'}</strong></td>
      <td>${u.email || 'N/A'}</td>
      <td>Niveau ${Math.floor((u.xp || 0) / 100) + 1}</td>
      <td><span class="role-badge role-${(u.role || 'member').toLowerCase()}">${(u.role || 'member').toUpperCase()}</span></td>
      <td>
        ${isOwner ? `
          <select onchange="changeUserRole('${uid}', this.value)" class="input-field" style="height: 34px; padding: 0 8px; font-size: 0.8rem;">
            <option value="member" ${u.role === 'member' ? 'selected' : ''}>Membre</option>
            <option value="moderator" ${u.role === 'moderator' ? 'selected' : ''}>Modérateur</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="owner" ${u.role === 'owner' ? 'selected' : ''}>Owner</option>
          </select>
        ` : `<span class="text-muted">Lecture seule</span>`}
      </td>
    </tr>
  `).join("");
}

window.changeUserRole = async function(targetUid, newRole) {
  if (state.userProfile?.role !== "owner") {
    showToast("Seul l'Owner peut modifier les rôles.");
    return;
  }
  try {
    await update(ref(db, `users/${targetUid}`), { role: newRole });
    showToast(`Rôle mis à jour : ${newRole.toUpperCase()}`);
  } catch (err) {
    showToast("Erreur lors du changement de rôle.");
  }
};

// ==========================================
// 10. SYNCHRONISATION FIREBASE (RÈGLES UTILISATEUR)
// ==========================================
function recordHistory(media, type) {
  if (!state.currentUser) return;
  const uid = state.currentUser.uid;
  const item = {
    title: media.title?.english || media.title?.romaji,
    cover: media.coverImage?.large,
    type,
    viewedAt: Date.now()
  };
  set(ref(db, `history/${uid}/${media.id}`), item);
}

function saveProgress(id, progData) {
  if (!state.currentUser) return;
  const uid = state.currentUser.uid;
  set(ref(db, `progress/${uid}/${id}`), {
    ...progData,
    lastUpdated: Date.now()
  });
}

async function toggleFavorite(media, type) {
  if (!state.currentUser) {
    openAuthModal();
    return;
  }
  const uid = state.currentUser.uid;
  const favRef = ref(db, `favorites/${uid}/${media.id}`);
  if (state.favorites[media.id]) {
    await remove(favRef);
    showToast("Retiré des favoris");
  } else {
    await set(favRef, {
      title: media.title?.english || media.title?.romaji,
      cover: media.coverImage?.large,
      type,
      addedAt: Date.now()
    });
    showToast("Ajouté aux favoris ❤️");
  }
}

async function toggleWatchlist(media, type) {
  if (!state.currentUser) {
    openAuthModal();
    return;
  }
  const uid = state.currentUser.uid;
  const watchRef = ref(db, `watchlist/${uid}/${media.id}`);
  if (state.watchlist[media.id]) {
    await remove(watchRef);
    showToast("Retiré de votre liste");
  } else {
    await set(watchRef, {
      title: media.title?.english || media.title?.romaji,
      cover: media.coverImage?.large,
      type,
      addedAt: Date.now()
    });
    showToast("Ajouté à 'À regarder' ✓");
  }
}

// Commentaires
async function postComment(contentId) {
  if (!state.currentUser) {
    openAuthModal();
    return;
  }
  const input = document.getElementById("commentTextInput");
  const text = input?.value?.trim();
  if (!text) return;

  const commentId = Date.now().toString();
  const commentData = {
    uid: state.currentUser.uid,
    username: state.userProfile?.username || state.currentUser.displayName || "Anonyme",
    text,
    createdAt: Date.now()
  };

  await set(ref(db, `comments/${contentId}/${commentId}`), commentData);
  input.value = "";
  showToast("Commentaire publié !");
}

function loadComments(contentId) {
  const container = document.getElementById("commentsList");
  if (!container) return;
  onValue(ref(db, `comments/${contentId}`), (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      container.innerHTML = `<p class="text-dim" style="font-size: 0.85rem;">Soyez le premier à commenter !</p>`;
      return;
    }
    container.innerHTML = Object.values(data).reverse().map(c => `
      <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;">
        <strong style="color: var(--accent-glow); font-size: 0.85rem;">${c.username}</strong>
        <p style="margin-top: 4px; font-size: 0.9rem;">${c.text}</p>
      </div>
    `).join("");
  });
}

// ==========================================
// 11. AUTHENTIFICATION FIREBASE
// ==========================================
function openAuthModal() {
  document.getElementById("authModal")?.classList.add("open");
}

function closeAuthModal() {
  document.getElementById("authModal")?.classList.remove("open");
}

let isAuthRegister = false;
document.getElementById("tabAuthLogin")?.addEventListener("click", () => {
  isAuthRegister = false;
  document.getElementById("tabAuthLogin").classList.add("active");
  document.getElementById("tabAuthRegister").classList.remove("active");
  document.getElementById("authUsernameGroup").style.display = "none";
  document.getElementById("btnSubmitAuth").textContent = "Se connecter";
});

document.getElementById("tabAuthRegister")?.addEventListener("click", () => {
  isAuthRegister = true;
  document.getElementById("tabAuthRegister").classList.add("active");
  document.getElementById("tabAuthLogin").classList.remove("active");
  document.getElementById("authUsernameGroup").style.display = "block";
  document.getElementById("btnSubmitAuth").textContent = "Créer mon compte";
});

document.getElementById("authForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmailInput").value;
  const password = document.getElementById("authPasswordInput").value;
  const username = document.getElementById("authUsernameInput")?.value;
  const errorEl = document.getElementById("authErrorMessage");
  errorEl.style.display = "none";

  try {
    if (isAuthRegister) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Créer le profil dans Realtime Database
      const uid = cred.user.uid;
      const initialProfile = {
        username: username || email.split("@")[0],
        email,
        role: "member",
        xp: 0,
        watchMinutes: 0,
        readMinutes: 0,
        createdAt: Date.now()
      };
      await set(ref(db, `users/${uid}`), initialProfile);
      showToast("Compte créé avec succès ! Bienvenue sur Otaku-World.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Connexion réussie !");
    }
    closeAuthModal();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  }
});

document.getElementById("btnLogout")?.addEventListener("click", () => signOut(auth));
document.getElementById("btnLoginTrigger")?.addEventListener("click", openAuthModal);
document.getElementById("btnOpenAuthFromProfile")?.addEventListener("click", openAuthModal);
document.getElementById("btnCloseAuthModal")?.addEventListener("click", closeAuthModal);
document.getElementById("authModalBackdrop")?.addEventListener("click", closeAuthModal);

// Observer Auth State
onAuthStateChanged(auth, (user) => {
  state.currentUser = user;
  const userArea = document.getElementById("userHeaderArea");
  const drawerCard = document.getElementById("drawerUserCard");
  const adminLink = document.getElementById("adminDrawerLink");

  if (user) {
    // Écouter le profil Realtime DB
    onValue(ref(db, `users/${user.uid}`), (snapshot) => {
      state.userProfile = snapshot.val() || {};
      const role = (state.userProfile.role || "member").toLowerCase();
      if (adminLink) {
        adminLink.style.display = ["owner", "admin", "moderator"].includes(role) ? "block" : "none";
      }
      if (userArea) {
        userArea.innerHTML = `
          <a href="#profile" class="btn btn-secondary btn-sm" style="display: flex; gap: 6px; align-items: center;">
            <img src="${state.userProfile.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.uid}" style="width: 22px; height: 22px; border-radius: 50%;">
            <span>${state.userProfile.username || 'Mon profil'}</span>
          </a>
        `;
      }
      if (drawerCard) {
        drawerCard.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-surface-elevated); border-radius: 12px;">
            <img src="${state.userProfile.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.uid}" style="width: 44px; height: 44px; border-radius: 50%;">
            <div>
              <strong>${state.userProfile.username || 'Otaku'}</strong>
              <div style="font-size: 0.75rem; color: var(--accent-glow);">Niveau ${Math.floor((state.userProfile.xp || 0) / 100) + 1} • ${(state.userProfile.role || 'membre').toUpperCase()}</div>
            </div>
          </div>
        `;
      }
      if (state.activeView === "profile") renderProfileView();
    });

    // Écouter les données utilisateur (favoris, historique, progression, watchlist)
    onValue(ref(db, `favorites/${user.uid}`), s => { state.favorites = s.val() || {}; if (state.activeView === "library") renderLibraryView(); });
    onValue(ref(db, `history/${user.uid}`), s => { state.history = s.val() || {}; if (state.activeView === "library") renderLibraryView(); });
    onValue(ref(db, `progress/${user.uid}`), s => { state.progress = s.val() || {}; renderContinueSection(); if (state.activeView === "library") renderLibraryView(); });
    onValue(ref(db, `watchlist/${user.uid}`), s => { state.watchlist = s.val() || {}; if (state.activeView === "library") renderLibraryView(); });

  } else {
    state.userProfile = null;
    state.favorites = {};
    state.history = {};
    state.progress = {};
    state.watchlist = {};
    if (adminLink) adminLink.style.display = "none";
    if (userArea) {
      userArea.innerHTML = `<button id="btnLoginTrigger2" class="btn btn-outline btn-sm">Connexion</button>`;
      document.getElementById("btnLoginTrigger2")?.addEventListener("click", openAuthModal);
    }
    if (drawerCard) {
      drawerCard.innerHTML = `
        <button id="btnOpenAuthFromDrawer" class="btn btn-primary btn-full">Connexion / Inscription</button>
      `;
      document.getElementById("btnOpenAuthFromDrawer")?.addEventListener("click", openAuthModal);
    }
  }
});

// ==========================================
// 12. INITIALISATION & LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Drawer mobile
  document.getElementById("btnDrawerOpen")?.addEventListener("click", () => document.getElementById("sideDrawer")?.classList.add("open"));
  document.getElementById("btnDrawerClose")?.addEventListener("click", () => document.getElementById("sideDrawer")?.classList.remove("open"));
  document.getElementById("drawerOverlay")?.addEventListener("click", () => document.getElementById("sideDrawer")?.classList.remove("open"));

  // Bottom Sheet Filtres
  document.getElementById("btnOpenFilterSheet")?.addEventListener("click", () => document.getElementById("filterBottomSheet")?.classList.add("open"));
  document.getElementById("btnCloseFilterSheet")?.addEventListener("click", () => document.getElementById("filterBottomSheet")?.classList.remove("open"));
  document.getElementById("filterSheetOverlay")?.addEventListener("click", () => document.getElementById("filterBottomSheet")?.classList.remove("open"));

  // Appliquer filtres
  document.getElementById("btnApplyFilters")?.addEventListener("click", () => {
    state.activeFilters.genre = document.getElementById("filterGenre").value;
    state.activeFilters.status = document.getElementById("filterStatus").value;
    state.activeFilters.sort = document.getElementById("filterSort").value;
    document.getElementById("filterBottomSheet")?.classList.remove("open");
    loadCatalogMedia();
  });

  // Onglets Catalogue Type
  document.querySelectorAll(".type-segmented-control .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeCatalogType = btn.getAttribute("data-type");
      updateCatalogTypeButtons();
      loadCatalogMedia();
    });
  });

  // Recherche dans le catalogue
  document.getElementById("catalogSearchInput")?.addEventListener("input", (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => loadCatalogMedia(), 400);
  });

  // Recherche globale
  document.getElementById("globalSearchInput")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    document.getElementById("btnClearSearch").style.display = val ? "block" : "none";
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => performGlobalSearch(val), 400);
  });

  document.getElementById("btnClearSearch")?.addEventListener("click", () => {
    const input = document.getElementById("globalSearchInput");
    if (input) input.value = "";
    document.getElementById("btnClearSearch").style.display = "none";
    performGlobalSearch("");
  });

  // Raccourci Ctrl+K / Trigger
  document.getElementById("btnHeaderSearch")?.addEventListener("click", () => {
    window.location.hash = "#search";
    setTimeout(() => document.getElementById("globalSearchInput")?.focus(), 200);
  });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      window.location.hash = "#search";
      setTimeout(() => document.getElementById("globalSearchInput")?.focus(), 200);
    }
  });

  // Boutons Retour
  document.getElementById("btnBackFromDetail")?.addEventListener("click", () => window.history.back());
  document.getElementById("btnBackFromPlayer")?.addEventListener("click", () => window.history.back());
  document.getElementById("btnBackFromReader")?.addEventListener("click", () => window.history.back());

  // Onglets Bibliothèque
  document.querySelectorAll(".lib-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      state.libraryTab = tab.getAttribute("data-tab");
      renderLibraryView();
    });
  });

  // Charger plus de titres dans le catalogue
  document.getElementById("btnLoadMoreCatalog")?.addEventListener("click", () => {
    catalogPage++;
    loadCatalogMedia(true);
  });

  // Initialiser la première vue
  navigateTo(window.location.hash);
});

// Enregistrement Service Worker PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
