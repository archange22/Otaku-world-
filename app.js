
// =============================================================================
// GESTIONNAIRE DE THÈMES (THÈME 1 : FrAnime / THÈME 2 : Anime-Sama)
// =============================================================================

function initThemeSystem() {
  const savedTheme = localStorage.getItem('otaku_theme') || 'theme-1';
  applyTheme(savedTheme);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.body.getAttribute('data-theme') || 'theme-1';
      const nextTheme = current === 'theme-1' ? 'theme-2' : 'theme-1';
      applyTheme(nextTheme);
    });
  }

  const drawerSelect = document.getElementById('drawerThemeSelect');
  if (drawerSelect) {
    drawerSelect.value = savedTheme;
    drawerSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }

  // Initialisation des accordéons Anime-Sama
  initAccordions();
  initFloatingSearchAndScroll();
}

function applyTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('otaku_theme', themeName);

  const label = document.getElementById('currentThemeLabel');
  if (label) {
    label.textContent = themeName === 'theme-2' ? 'Thème 2 (Anime-Sama)' : 'Thème 1 (FrAnime)';
  }

  const drawerSelect = document.getElementById('drawerThemeSelect');
  if (drawerSelect && drawerSelect.value !== themeName) {
    drawerSelect.value = themeName;
  }
}

function initAccordions() {
  document.querySelectorAll('.as-acc-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.as-accordion-card');
      if (card) {
        card.classList.toggle('collapsed');
      }
    });
  });

  // Filtres accordéons réactifs
  const filterInputs = document.querySelectorAll('#theme2AccordionFilters input');
  filterInputs.forEach(input => {
    input.addEventListener('change', () => {
      applyTheme2CatalogFilters();
    });
    if (input.type === 'number') {
      input.addEventListener('input', debounce(() => {
        applyTheme2CatalogFilters();
      }, 500));
    }
  });
}

function initFloatingSearchAndScroll() {
  const floatingInput = document.getElementById('asFloatingSearchInput');
  if (floatingInput) {
    floatingInput.addEventListener('input', debounce((e) => {
      const q = e.target.value.trim();
      const mainSearch = document.getElementById('headerSearchInput');
      if (mainSearch) mainSearch.value = q;
      if (q.length > 1) {
        navigateTo('search', { query: q });
      }
    }, 400));
  }

  const scrollBtn = document.getElementById('asScrollTopBtn');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

function applyTheme2CatalogFilters() {
  // Récupérer les filtres actifs
  const checkedTypes = Array.from(document.querySelectorAll('input[name="as_type"]:checked')).map(i => i.value);
  const checkedLangs = Array.from(document.querySelectorAll('input[name="as_lang"]:checked')).map(i => i.value);
  const checkedStatus = Array.from(document.querySelectorAll('input[name="as_status"]:checked')).map(i => i.value);
  const yearMin = document.getElementById('asYearMin')?.value;
  const yearMax = document.getElementById('asYearMax')?.value;
  const checkedGenres = Array.from(document.querySelectorAll('input[name="as_genre"]:checked')).map(i => i.value);

  // Appliquer la recherche au catalogue
  fetchFilteredCatalog({
    types: checkedTypes,
    langs: checkedLangs,
    status: checkedStatus,
    yearMin: yearMin ? parseInt(yearMin) : null,
    yearMax: yearMax ? parseInt(yearMax) : null,
    genres: checkedGenres
  });
}

// Fonction utilitaire de debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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
// ÉTAT DE L'APPLICATION
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
  currentChapterPages: [],
  currentMangaPage: 0,
  mangaReadingMode: "page",
  currentAnimeLang: "VOSTFR",
  latestEpLangFilter: "VOSTFR",
  libraryTab: "continue",
  favorites: {},
  history: {},
  progress: {},
  watchlist: {},
  xpTimer: null,
  // Système thèmes FrAnime
  selectedThemes: new Set(),
  themeLogic: "AND" // "AND" ou "OR"
};

// ==========================================
// NOTIFICATIONS
// ==========================================
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ==========================================
// SÉQUENCE D'ÉCRAN DE CHARGEMENT (SPLASH SCREEN)
// ==========================================
function runSplashScreen() {
  const splash = document.getElementById("splashScreen");
  const bar = document.getElementById("splashProgressBar");
  const sProfile = document.getElementById("stepProfile");
  const sPrefs = document.getElementById("stepPrefs");
  const sAnime = document.getElementById("stepAnime");

  if (!splash) return;

  setTimeout(() => {
    if (bar) bar.style.width = "40%";
    if (sProfile) { sProfile.classList.remove("active"); sProfile.classList.add("done"); }
    if (sPrefs) sPrefs.classList.add("active");
  }, 400);

  setTimeout(() => {
    if (bar) bar.style.width = "80%";
    if (sPrefs) { sPrefs.classList.remove("active"); sPrefs.classList.add("done"); }
    if (sAnime) sAnime.classList.add("active");
  }, 800);

  setTimeout(() => {
    if (bar) bar.style.width = "100%";
    if (sAnime) { sAnime.classList.remove("active"); sAnime.classList.add("done"); }
    setTimeout(() => {
      splash.classList.add("fade-out");
    }, 300);
  }, 1200);
}

// ==========================================
// API ANILIST GRAPHQL
// ==========================================
async function fetchAniList(query, variables = {}) {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    return data?.data || null;
  } catch (err) {
    console.error("AniList Error:", err);
    return null;
  }
}

// ==========================================
// GESTION DU ROUTEUR & DES VUES
// ==========================================
function navigateTo(hash) {
  if (!hash) hash = "#home";
  const [route, queryString] = hash.replace("#", "").split("?");
  const params = new URLSearchParams(queryString || "");

  document.getElementById("sideDrawer")?.classList.remove("open");
  document.getElementById("filterBottomSheet")?.classList.remove("open");

  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-link, .bottom-nav-item, .sidebar-link").forEach(el => {
    const target = el.getAttribute("data-nav") || el.getAttribute("data-tab");
    if (target === route || (target && target.startsWith("catalog") && route === "catalog")) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });

  state.activeView = route;
  document.body.classList.toggle("has-player", route === "player" || route === "reader");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (route === "home") {
    document.getElementById("viewHome")?.classList.add("active");
    renderHomeView();
  } else if (route === "catalog") {
    document.getElementById("viewCatalog")?.classList.add("active");
    if (params.get("type")) state.activeCatalogType = params.get("type");
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
    loadMediaDetail(params.get("id"), params.get("type") || "anime");
  } else if (route === "player") {
    document.getElementById("viewVideoPlayer")?.classList.add("active");
    startAnimePlayer(params.get("id"), params.get("season") || 1, params.get("ep") || 1);
  } else if (route === "reader") {
    document.getElementById("viewMangaReader")?.classList.add("active");
    startMangaReader(params.get("id"), params.get("ch") || 1);
  } else if (route === "library") {
    document.getElementById("viewLibrary")?.classList.add("active");
    state.libraryTab = params.get("tab") || "continue";
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
// 1. VUE ACCUEIL (SYSTÈMES & THÈME FR-ANIME)
// ==========================================
let allHomeAnimePool = [];


async function fetchTodayAiringSchedule() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const endOfDay = startOfDay + 86400;

  const query = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 12) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          episode
          media {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
            averageScore
            countryOfOrigin
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { start: Math.floor(startOfDay), end: Math.floor(endOfDay) } })
    });
    const data = await res.json();
    return data?.data?.Page?.airingSchedules || [];
  } catch (err) {
    console.warn("Échec récupération planning en direct:", err);
    return [];
  }
}


async function renderHomeView() {
  // 1. Titre du jour pour le planning
  const days = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
  const todayName = days[new Date().getDay()];
  const calTitle = document.getElementById("calendarDayTitle");
  if (calTitle) calTitle.textContent = `Aujourd'hui ${todayName}`;

  // 2. Gestion bandeau invité
  const guestNotice = document.getElementById("guestHistoryNotice");
  if (guestNotice) guestNotice.style.display = state.currentUser ? "none" : "flex";

  renderContinueSection();

  // 3. Récupération des données AniList
  const data = await fetchAniList(`
    query {
      trending: Page(page: 1, perPage: 12) {
        media(sort: TRENDING_DESC, isAdult: false, type: ANIME) {
          id title { romaji english native } coverImage { large extraLarge } bannerImage
          description averageScore seasonYear episodes format genres popularity
        }
      }
      popular: Page(page: 1, perPage: 10) {
        media(sort: POPULARITY_DESC, isAdult: false, type: ANIME) {
          id title { romaji english } coverImage { large } format averageScore seasonYear episodes popularity
        }
      }
      latest: Page(page: 1, perPage: 10) {
        media(sort: START_DATE_DESC, isAdult: false, type: ANIME, status: RELEASING) {
          id title { romaji english } coverImage { large } format averageScore seasonYear episodes
        }
      }
    }
  `);

  if (!data) return;

  const trendingList = data.trending?.media || [];
  const popularList = data.popular?.media || [];
  const latestList = data.latest?.media || [];
  allHomeAnimePool = [...trendingList, ...popularList];

  // Hero Banner avec bouton Surprends-moi
  const featured = trendingList[0];
  if (featured) {
    const banner = document.getElementById("heroBanner");
    const bannerImg = featured.bannerImage || featured.coverImage.extraLarge;
    const title = featured.title.english || featured.title.romaji;
    banner.style.backgroundImage = `url('${bannerImg}')`;
    banner.innerHTML = `
      <div class="hero-content">
        <span class="hero-tag">🔥 Tendance N°1</span>
        <h1 class="hero-title">${title}</h1>
        <p class="hero-desc">${(featured.description || "").replace(/<[^>]*>?/gm, '')}</p>
        <div class="hero-actions">
          <a href="#player?id=${featured.id}&season=1&ep=1" class="btn btn-primary btn-lg">▶ Regarder en VOSTFR</a>
          <button id="btnSurpriseMe" class="btn btn-surprise btn-lg">🔀 Surprends-moi</button>
        </div>
      </div>
    `;
    document.getElementById("btnSurpriseMe")?.addEventListener("click", triggerSurpriseMe);
  }

  // 1. Derniers épisodes
  renderLatestEpisodes(latestList);

  // 2. Planning du jour avec heures simulées (08h20, 14h15, etc.)
  const realAiring = await fetchTodayAiringSchedule();
    if (realAiring && realAiring.length > 0) {
      renderScheduleCards(realAiring, true);
    } else {
      renderScheduleCards(trendingList.slice(0, 8), false);
    }

  // 3. Top de la semaine avec #1, #2... et nombre de vues
  renderRankedCards("weeklyTopGrid", trendingList.slice(0, 8), "views");

  // 4. Les plus aimés avec likes
  renderRankedCards("mostLikedGrid", popularList.slice(0, 8), "likes");

  // 5. Cette saison
  renderRankedCards("currentSeasonGrid", latestList.slice(0, 8), "none");

  // 6. Nuage de thèmes interactif
  setupThemeCloud();
}

function triggerSurpriseMe() {
  if (allHomeAnimePool.length === 0) return;
  const randomAnime = allHomeAnimePool[Math.floor(Math.random() * allHomeAnimePool.length)];
  showToast(`🎲 Vous découvrez : ${randomAnime.title.english || randomAnime.title.romaji}`);
  window.location.hash = `#detail?id=${randomAnime.id}&type=anime`;
}

function renderLatestEpisodes(list) {
  const container = document.getElementById("latestEpisodesGrid");
  if (!container) return;

  const times = ["Il y a 25 min", "Il y a 45 min", "Il y a 1h", "Il y a 2h", "Il y a 3h", "Il y a 4h"];
  container.innerHTML = list.map((item, idx) => {
    const title = item.title?.english || item.title?.romaji;
    const timeAgo = times[idx % times.length];
    const score = item.averageScore ? (item.averageScore / 10).toFixed(1) : "8.2";
    return `
      <div class="media-card" onclick="window.location.hash = '#player?id=${item.id}&season=1&ep=1'">
        <img class="media-card-poster" src="${item.coverImage?.large}" alt="${title}" loading="lazy">
        <span class="rank-badge" style="background: rgba(225, 29, 72, 0.9); font-size: 0.65rem;">S 1</span>
        <div class="card-stat-overlay">★ ${score}</div>
        <div class="card-lang-badge ${state.latestEpLangFilter === 'VF' ? 'vf' : ''}">${state.latestEpLangFilter}</div>
        <div class="media-card-body">
          <h4 class="media-card-title">${title}</h4>
          <div class="media-card-meta">
            <span style="color: var(--accent-glow);">${timeAgo}</span>
            <span>EP 1</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderScheduleCards(list, isLiveSchedule = false) {
  const container = document.getElementById("todayScheduleGrid");
  if (!container) return;
  
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="empty-state-notice">Aucune diffusion officielle répertoriée pour aujourd\'hui. Consultez le catalogue complet.</div>';
    return;
  }

  container.innerHTML = list.map((item, idx) => {
    const media = item.media || item;
    const title = media.title?.english || media.title?.romaji || "Titre inconnu";
    let hourDisplay = "";
    let isUnavailable = false;

    if (item.airingAt) {
      const airDate = new Date(item.airingAt * 1000);
      hourDisplay = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    } else {
      hourDisplay = "Horaire à confirmer";
      isUnavailable = true;
    }

    const epNumber = item.episode || (media.nextAiringEpisode ? media.nextAiringEpisode.episode : null);
    const epDisplay = epNumber ? `Épisode ${epNumber}` : 'Épisode à paraître';

    return `
      <div class="schedule-card" onclick="openMedia(${media.id})">
        <div class="schedule-thumb-wrap">
          <img src="${media.coverImage?.large || ''}" alt="${title}" loading="lazy">
          <div class="schedule-time-badge ${isUnavailable ? 'badge-unavailable' : 'badge-live-schedule'}">
            ${isUnavailable ? '⏳ ' + hourDisplay : '🟢 ' + hourDisplay}
          </div>
        </div>
        <div class="schedule-info">
          <div class="schedule-title">${title}</div>
          <div class="schedule-sub">${epDisplay} · <span class="badge-lang badge-vostfr">VOSTFR</span></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderRankedCards(containerId, list, type = "views") {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = list.map((item, idx) => {
    const title = item.title?.english || item.title?.romaji;
    const score = item.averageScore ? (item.averageScore / 10).toFixed(1) : "8.0";
    let overlayText = "";
    if (type === "views") {
      const views = (120000 - idx * 11500).toLocaleString("fr-FR");
      overlayText = `👁️ ${views}`;
    } else if (type === "likes") {
      const likes = (12400 - idx * 1100).toLocaleString("fr-FR");
      overlayText = `👍 ${likes}`;
    } else {
      overlayText = `★ ${score}`;
    }

    return `
      <div class="media-card" onclick="window.location.hash = '#detail?id=${item.id}&type=anime'">
        <img class="media-card-poster" src="${item.coverImage?.large}" alt="${title}" loading="lazy">
        <span class="rank-badge">#${idx + 1}</span>
        <div class="card-stat-overlay">${overlayText}</div>
        <div class="card-lang-badge">VOSTFR</div>
        <div class="media-card-body">
          <h4 class="media-card-title">${title}</h4>
          <div class="media-card-meta">
            <span>Saison 1</span>
            <span class="score-tag">★ ${score}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Nuage de thèmes interactif (Recherche rapide FrAnime)
const THEMES_LIST = [
  "TOUT", "Action", "Aventure", "Comédie", "Drame", "Fantaisie", "Horreur",
  "Isekai", "Magie", "Mecha", "Mystère", "Psychologique", "Romance",
  "Sci-Fi", "Seinen", "Shounen", "Slice of Life", "Sport", "Super pouvoir", "Surnaturel", "Thriller"
];

function setupThemeCloud() {
  const cloud = document.getElementById("themeTagsCloud");
  if (!cloud) return;

  cloud.innerHTML = THEMES_LIST.map(t => {
    const isAll = t === "TOUT";
    const isActive = isAll ? state.selectedThemes.size === 0 : state.selectedThemes.has(t);
    return `
      <button class="theme-chip ${isAll ? 'all' : ''} ${isActive ? 'active' : ''}" data-theme="${t}">
        ${t}
      </button>
    `;
  }).join("");

  cloud.querySelectorAll(".theme-chip").forEach(btn => {
    btn.onclick = () => {
      const theme = btn.getAttribute("data-theme");
      if (theme === "TOUT") {
        state.selectedThemes.clear();
      } else {
        if (state.selectedThemes.has(theme)) state.selectedThemes.delete(theme);
        else state.selectedThemes.add(theme);
      }
      setupThemeCloud();
      filterByThemes();
    };
  });
}

function filterByThemes() {
  const resultsContainer = document.getElementById("themeSearchResults");
  if (!resultsContainer) return;

  if (state.selectedThemes.size === 0) {
    resultsContainer.innerHTML = "";
    return;
  }

  const themesArray = Array.from(state.selectedThemes);
  const matched = allHomeAnimePool.filter(anime => {
    const animeGenres = anime.genres || [];
    if (state.themeLogic === "AND") {
      return themesArray.every(t => animeGenres.some(g => g.toLowerCase() === t.toLowerCase()));
    } else {
      return themesArray.some(t => animeGenres.some(g => g.toLowerCase() === t.toLowerCase()));
    }
  });

  if (matched.length === 0) {
    resultsContainer.innerHTML = `<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 20px;">Aucun anime ne correspond à cette combinaison de thèmes.</p>`;
    return;
  }

  resultsContainer.innerHTML = matched.map(m => `
    <div class="media-card" onclick="window.location.hash = '#detail?id=${m.id}&type=anime'">
      <img class="media-card-poster" src="${m.coverImage?.large}" alt="${m.title?.romaji}">
      <div class="card-lang-badge">VOSTFR</div>
      <div class="media-card-body">
        <h4 class="media-card-title">${m.title?.english || m.title?.romaji}</h4>
        <div class="media-card-meta">
          <span>${m.genres?.[0] || 'Anime'}</span>
          <span class="score-tag">★ ${(m.averageScore / 10).toFixed(1)}</span>
        </div>
      </div>
    </div>
  `).join("");
}

// Section Continuer à regarder
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
    const isManga = p.type === "manga";
    const sub = isManga ? `CH ${p.chapter || 1}` : `S${p.season || 1} • EP ${p.episode || 1}`;
    const resumeLink = isManga ? `#reader?id=${id}&ch=${p.chapter || 1}` : `#player?id=${id}&season=${p.season || 1}&ep=${p.episode || 1}`;

    return `
      <div class="media-card" onclick="window.location.hash = '${resumeLink}'">
        <img class="media-card-poster" src="${p.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200'}">
        <span class="rank-badge" style="background: rgba(124, 58, 237, 0.9);">REPRENDRE</span>
        <div class="card-lang-badge">VOSTFR</div>
        <div class="media-card-body">
          <h4 class="media-card-title">${p.title || 'En cours'}</h4>
          <div class="media-card-meta">
            <span style="color: var(--accent-glow);">${sub}</span>
            <span>${p.progressPercent || 30}%</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 2. VUE CATALOGUE
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

  const query = `
    query ($page: Int, $type: MediaType, $sort: [MediaSort], $genre: String, $search: String) {
      Page(page: $page, perPage: 18) {
        media(type: $type, sort: $sort, genre: $genre, search: $search, isAdult: false) {
          id title { romaji english } coverImage { large } format averageScore seasonYear episodes chapters
        }
      }
    }
  `;

  const data = await fetchAniList(query, {
    page: catalogPage,
    type: state.activeCatalogType === "all" ? undefined : aniListType,
    sort: [state.activeFilters.sort || "POPULARITY_DESC"],
    genre: state.activeFilters.genre || undefined,
    search: document.getElementById("catalogSearchInput")?.value?.trim() || undefined
  });

  const items = data?.Page?.media || [];
  if (!append) grid.innerHTML = "";

  if (items.length === 0 && !append) {
    grid.innerHTML = `<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 40px;">Aucun titre trouvé.</p>`;
    return;
  }

  const html = items.map(item => {
    const title = item.title?.english || item.title?.romaji || "Titre";
    const score = item.averageScore ? (item.averageScore / 10).toFixed(1) : "8.0";
    const type = item.format === "MANGA" ? "manga" : (state.activeCatalogType === "all" ? "anime" : state.activeCatalogType);
    return `
      <div class="media-card" onclick="window.location.hash = '#detail?id=${item.id}&type=${type}'">
        <img class="media-card-poster" src="${item.coverImage?.large}" alt="${title}" loading="lazy">
        <div class="card-lang-badge">VOSTFR</div>
        <div class="media-card-body">
          <h4 class="media-card-title">${title}</h4>
          <div class="media-card-meta">
            <span>${item.seasonYear || item.format || ''}</span>
            <span class="score-tag">★ ${score}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.insertAdjacentHTML("beforeend", html);
}

// ==========================================
// 3. RECHERCHE GLOBALE
// ==========================================
let searchDebounce = null;

async function performGlobalSearch(query) {
  const resultsArea = document.getElementById("searchResultsArea");
  if (!resultsArea) return;
  if (!query || query.trim().length < 2) {
    resultsArea.innerHTML = `<p class="text-muted" style="text-align: center; padding: 40px;">Tapez au moins 2 lettres pour chercher.</p>`;
    return;
  }

  resultsArea.innerHTML = `<div class="spinner" style="margin: 40px auto;"></div>`;

  const data = await fetchAniList(`
    query ($search: String) {
      anime: Page(page: 1, perPage: 8) {
        media(search: $search, type: ANIME, isAdult: false) {
          id title { romaji english } coverImage { large } averageScore format episodes
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
    resultsArea.innerHTML = `<p class="text-muted" style="text-align: center; padding: 40px;">Aucun résultat trouvé pour "${query}".</p>`;
    return;
  }

  let html = "";
  if (animes.length > 0) {
    html += `<h3 class="section-title" style="margin: 16px 0 10px 0;">📺 Anime (${animes.length})</h3><div class="media-grid">`;
    html += animes.map(i => `
      <div class="media-card" onclick="window.location.hash = '#detail?id=${i.id}&type=anime'">
        <img class="media-card-poster" src="${i.coverImage?.large}" alt="${i.title?.romaji}">
        <div class="card-lang-badge">VOSTFR</div>
        <div class="media-card-body">
          <h4 class="media-card-title">${i.title?.english || i.title?.romaji}</h4>
          <div class="media-card-meta"><span>${i.episodes || ''} eps</span><span class="score-tag">★ ${(i.averageScore/10).toFixed(1)}</span></div>
        </div>
      </div>
    `).join("");
    html += `</div>`;
  }
  if (mangas.length > 0) {
    html += `<h3 class="section-title" style="margin: 24px 0 10px 0;">📖 Manga (${mangas.length})</h3><div class="media-grid">`;
    html += mangas.map(i => `
      <div class="media-card" onclick="window.location.hash = '#detail?id=${i.id}&type=manga'">
        <img class="media-card-poster" src="${i.coverImage?.large}" alt="${i.title?.romaji}">
        <div class="card-lang-badge">FR</div>
        <div class="media-card-body">
          <h4 class="media-card-title">${i.title?.english || i.title?.romaji}</h4>
          <div class="media-card-meta"><span>${i.chapters || ''} ch</span><span class="score-tag">★ ${(i.averageScore/10).toFixed(1)}</span></div>
        </div>
      </div>
    `).join("");
    html += `</div>`;
  }
  resultsArea.innerHTML = html;
}

// ==========================================
// 4. FICHE DÉTAILLÉE
// ==========================================
async function loadMediaDetail(id, type = "anime") {
  const container = document.getElementById("mediaDetailContent");
  const backdrop = document.getElementById("mediaDetailBackdrop");
  if (!container) return;

  container.innerHTML = `<div class="spinner" style="margin: 60px auto;"></div>`;

  const data = await fetchAniList(`
    query ($id: Int) {
      Media(id: $id, isAdult: false) {
        id title { romaji english native }
        coverImage { extraLarge large } bannerImage
        description averageScore seasonYear status episodes chapters
        format genres duration trailer { id site }
      }
    }
  `, { id: parseInt(id) });

  const media = data?.Media;
  if (!media) {
    container.innerHTML = `<p class="text-muted" style="padding: 40px;">Fiche introuvable.</p>`;
    return;
  }
  state.currentMedia = { ...media, type };

  // Historique Firebase
  if (state.currentUser) {
    set(ref(db, `history/${state.currentUser.uid}/${media.id}`), {
      title: media.title.english || media.title.romaji,
      cover: media.coverImage.large,
      type,
      viewedAt: Date.now()
    });
  }

  const bgImg = media.bannerImage || media.coverImage.extraLarge;
  if (backdrop) backdrop.style.backgroundImage = `url('${bgImg}')`;

  const title = media.title.english || media.title.romaji;
  const isFav = !!state.favorites[id];
  const isWatch = !!state.watchlist[id];
  const totalEps = media.episodes || 12;

  let actionHtml = type === "anime"
    ? `<a href="#player?id=${media.id}&season=1&ep=1" class="btn btn-primary btn-lg">▶ Regarder en VOSTFR</a>`
    : `<a href="#reader?id=${media.id}&ch=1" class="btn btn-primary btn-lg">📖 Lire le manga</a>`;

  actionHtml += `
    <button id="btnToggleWatchlist" class="btn btn-secondary ${isWatch ? 'active' : ''}">${isWatch ? '✓ Dans ma liste' : '＋ Ma liste'}</button>
    <button id="btnToggleFavorite" class="btn btn-secondary ${isFav ? 'active' : ''}">${isFav ? '❤️ Favori' : '♡ Favori'}</button>
  `;

  let mediaBody = "";
  if (type === "anime") {
    mediaBody = `
      <div class="detail-episodes-box">
        <div class="episodes-header-bar">
          <h3>Saisons</h3>
          <div class="lang-selector-group">
            <button class="lang-pill active">VOSTFR</button>
            <button class="lang-pill">VF</button>
          </div>
        </div>
        <div class="episodes-grid-large" style="margin-top: 14px;">
          ${Array.from({ length: Math.min(totalEps, 24) }, (_, i) => `
            <a href="#player?id=${media.id}&season=1&ep=${i+1}" class="ep-btn ${epClass(media.id, i+1)}">
              <span>EP ${i + 1 < 10 ? '0' + (i+1) : i+1}</span>
              <span class="ep-btn-sub">Épisode ${i + 1}</span>
            </a>
          `).join("")}
        </div>
      </div>
    `;
  } else {
    mediaBody = `
      <div class="detail-episodes-box">
        <div class="episodes-header-bar">
          <h3>Chapitres MangaDex</h3>
          <span class="section-tag">🇫🇷 Traduction FR</span>
        </div>
        <div id="mangaChapListDetail" style="margin-top: 14px;"><div class="spinner"></div></div>
      </div>
    `;
    fetchMangaDexForDetail(title, media.id);
  }

  container.innerHTML = `
    <div class="detail-hero">
      <img src="${media.coverImage.extraLarge || media.coverImage.large}" class="detail-poster" alt="${title}">
      <div class="detail-header-info">
        <h1 class="detail-title">${title}</h1>
        <p class="detail-alt-title">${media.title.native || ''}</p>
        <div class="detail-badges">
          <span class="detail-badge score">★ ${(media.averageScore / 10).toFixed(1)}</span>
          <span class="detail-badge">${media.seasonYear || ''}</span>
          <span class="detail-badge">${media.status || ''}</span>
          ${(media.genres || []).map(g => `<span class="detail-badge">${g}</span>`).join("")}
        </div>
        <div class="detail-actions-row">
          ${actionHtml}
        </div>
      </div>
    </div>
    <div class="detail-synopsis-box">
      <h3>Synopsis</h3>
      <p class="detail-synopsis-text">${(media.description || "Aucun résumé disponible.").replace(/<[^>]*>?/gm, '')}</p>
    </div>
    ${mediaBody}
  `;

  document.getElementById("btnToggleFavorite")?.addEventListener("click", () => toggleFavorite(media, type));
  document.getElementById("btnToggleWatchlist")?.addEventListener("click", () => toggleWatchlist(media, type));
}

async function fetchMangaDexForDetail(title, mediaId) {
  const box = document.getElementById("mangaChapListDetail");
  if (!box) return;
  try {
    const s = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=1`);
    const sData = await s.json();
    const manga = sData?.data?.[0];
    if (!manga) {
      box.innerHTML = `<p class="text-muted">Aucun chapitre disponible pour ce titre sur MangaDex.</p>`;
      return;
    }
    state.currentMangaDexId = manga.id;
    const feed = await fetch(`https://api.mangadex.org/manga/${manga.id}/feed?translatedLanguage[]=fr&order[chapter]=asc&limit=50`);
    const feedData = await feed.json();
    const chapters = feedData?.data || [];
    if (chapters.length === 0) {
      box.innerHTML = `<p class="text-muted">Chapitres en cours de traduction.</p>`;
      return;
    }
    box.innerHTML = `
      <div class="episodes-grid-large">
        ${chapters.map((c, i) => `
          <a href="#reader?id=${mediaId}&ch=${c.attributes?.chapter || i+1}" class="ep-btn">
            <span>CH ${c.attributes?.chapter || i+1}</span>
            <span class="ep-btn-sub">FR</span>
          </a>
        `).join("")}
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<p class="text-muted">Connexion à MangaDex indisponible.</p>`;
  }
}

// ==========================================
// 5. LECTEUR VIDÉO
// ==========================================
async function startAnimePlayer(mediaId, season = 1, ep = 1) {
  season = parseInt(season);
  ep = parseInt(ep);

  // Arrivée directe (hero, lien partagé) : on charge la fiche si elle manque
  if (!state.currentMedia || String(state.currentMedia.id) !== String(mediaId)) {
    const d = await fetchAniList(
      `query ($id: Int) { Media(id: $id, isAdult: false) {
        id title { romaji english } coverImage { large } episodes trailer { id site } } }`,
      { id: parseInt(mediaId) }
    );
    if (d?.Media) state.currentMedia = { ...d.Media, type: "anime" };
  }
  const media = state.currentMedia;
  const title = media?.title?.english || media?.title?.romaji || "Anime";
  const total = media?.episodes || 12;

  document.getElementById("playerAnimeTitle").textContent = title;
  document.getElementById("playerEpisodeSubtitle").textContent = `Saison ${season} • Épisode ${ep}`;
  document.getElementById("playerCurrentBadge").textContent = `EP ${ep}`;

  const prev = document.getElementById("btnPrevEpisode");
  const next = document.getElementById("btnNextEpisode");
  prev.disabled = ep <= 1;
  next.disabled = ep >= total;
  prev.onclick = () => (window.location.hash = `#player?id=${mediaId}&season=${season}&ep=${ep - 1}`);
  next.onclick = () => (window.location.hash = `#player?id=${mediaId}&season=${season}&ep=${ep + 1}`);

  document.getElementById("playerEpisodesGrid").innerHTML = Array.from({ length: Math.min(total, 100) }, (_, i) => {
    const n = i + 1;
    const cls = n === ep ? "current" : epClass(mediaId, n);
    return `<a href="#player?id=${mediaId}&season=${season}&ep=${n}" class="ep-btn ${cls}">${String(n).padStart(2, "0")}</a>`;
  }).join("");

  // Source vidéo : uniquement des contenus que tu as le droit de diffuser.
  // Ici : bande-annonce YouTube officielle (AniList) ou vidéo de démonstration.
  const container = document.getElementById("playerContainer");
  container.innerHTML =
    media?.trailer?.site === "youtube" && media?.trailer?.id
      ? `<iframe src="https://www.youtube.com/embed/${media.trailer.id}" allowfullscreen allow="autoplay; picture-in-picture"></iframe>`
      : `<video controls playsinline><source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4"></video>`;

  if (state.currentUser) {
    set(ref(db, `progress/${state.currentUser.uid}/${mediaId}`), {
      title, cover: media?.coverImage?.large, season, episode: ep, type: "anime",
      progressPercent: Math.min(100, Math.round((ep / total) * 100)), lastUpdated: Date.now()
    });
  }
  startXpTimer();
}

// Les cartes utilisent onclick="openMedia(id)" : le module ES ne l'exposait pas.
window.openMedia = (id) => (window.location.hash = `#detail?id=${id}&type=anime`);

// État d'un épisode pour la grille : "seen" si avant le dernier épisode regardé
function epClass(mediaId, n) {
  const last = state.progress?.[mediaId]?.episode || 0;
  return n < last ? "seen" : n === last ? "current" : "";
}

// ==========================================
// 6. LECTEUR MANGA (MANGADEX REEL)
// ==========================================
async function startMangaReader(mediaId, chapterNum = 1) {
  const loader = document.getElementById("mangaPageLoader");
  const container = document.getElementById("mangaPageContainer");
  const title = state.currentMedia?.title?.english || state.currentMedia?.title?.romaji || "Manga";

  document.getElementById("readerMangaTitle").textContent = title;
  document.getElementById("readerChapterBadge").textContent = `Chapitre ${chapterNum}`;

  if (loader) loader.style.display = "flex";
  if (container) container.innerHTML = "";

  try {
    let mId = state.currentMangaDexId;
    if (!mId) {
      const s = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=1`);
      const sData = await s.json();
      mId = sData?.data?.[0]?.id;
      state.currentMangaDexId = mId;
    }
    const feed = await fetch(`https://api.mangadex.org/manga/${mId}/feed?translatedLanguage[]=fr&order[chapter]=asc&limit=50`);
    const feedData = await feed.json();
    const chs = feedData?.data || [];
    const target = chs.find(c => c.attributes?.chapter == chapterNum) || chs[0];

    const atHome = await fetch(`https://api.mangadex.org/at-home/server/${target.id}`);
    const atHomeData = await atHome.json();
    const baseUrl = atHomeData.baseUrl;
    const hash = atHomeData.chapter.hash;
    const pages = atHomeData.chapter.data.map(f => `${baseUrl}/data/${hash}/${f}`);

    state.currentChapterPages = pages;
    state.currentMangaPage = 0;

    if (loader) loader.style.display = "none";
    document.getElementById("mangaTotalPages").textContent = pages.length;
    renderMangaPage();

    if (state.currentUser) {
      set(ref(db, `progress/${state.currentUser.uid}/${mediaId}`), {
        title,
        cover: state.currentMedia?.coverImage?.large,
        chapter: chapterNum,
        page: 1,
        type: "manga",
        progressPercent: 20,
        lastUpdated: Date.now()
      });
    }
  } catch (err) {
    if (loader) loader.innerHTML = `<p class="text-danger">Impossible de charger ce chapitre.</p>`;
  }
  startXpTimer();
}

function renderMangaPage() {
  const container = document.getElementById("mangaPageContainer");
  const curEl = document.getElementById("mangaCurrentPage");
  const pages = state.currentChapterPages;
  if (!container || pages.length === 0) return;

  if (state.mangaReadingMode === "page") {
    container.innerHTML = `<img src="${pages[state.currentMangaPage]}" class="manga-page-img" alt="Page ${state.currentMangaPage + 1}">`;
    if (curEl) curEl.textContent = state.currentMangaPage + 1;
  } else {
    container.innerHTML = pages.map((u, i) => `<img src="${u}" class="manga-page-img" loading="lazy">`).join("");
  }
}

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

// ==========================================
// 7. MA BIBLIOTHÈQUE
// ==========================================
function renderLibraryView() {
  const grid = document.getElementById("libraryContentGrid");
  const empty = document.getElementById("libraryEmptyState");
  if (!grid || !empty) return;

  document.getElementById("countContinue").textContent = Object.keys(state.progress).length;
  document.getElementById("countFavorites").textContent = Object.keys(state.favorites).length;
  document.getElementById("countWatchlist").textContent = Object.keys(state.watchlist).length;
  document.getElementById("countHistory").textContent = Object.keys(state.history).length;

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

  grid.innerHTML = entries.map(([id, it]) => `
    <div class="media-card" onclick="window.location.hash = '#detail?id=${id}&type=${it.type || 'anime'}'">
      <img class="media-card-poster" src="${it.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200'}">
      <div class="card-lang-badge">VOSTFR</div>
      <div class="media-card-body">
        <h4 class="media-card-title">${it.title || 'Titre'}</h4>
        <div class="media-card-meta"><span>${it.type?.toUpperCase() || 'ANIME'}</span></div>
      </div>
    </div>
  `).join("");
}

// ==========================================
// 8. PROFIL & XP
// ==========================================
function renderProfileView() {
  const logged = document.getElementById("profileLoggedView");
  const guest = document.getElementById("profileGuestView");
  if (!state.currentUser) {
    if (logged) logged.style.display = "none";
    if (guest) guest.style.display = "block";
    return;
  }
  if (logged) logged.style.display = "block";
  if (guest) guest.style.display = "none";

  const p = state.userProfile || {};
  document.getElementById("profileUsername").textContent = p.username || state.currentUser.displayName || "Otaku";
  document.getElementById("profileEmail").textContent = state.currentUser.email;

  const xp = p.xp || 0;
  const level = Math.floor(xp / 100) + 1;
  document.getElementById("profileLevel").textContent = level;
  document.getElementById("profileCurrentXp").textContent = xp % 100;
  document.getElementById("profileXpBar").style.width = `${xp % 100}%`;

  document.getElementById("statWatchTime").textContent = `${Math.floor((p.watchMinutes || 0)/60)} h`;
  document.getElementById("statReadTime").textContent = `${Math.floor((p.readMinutes || 0)/60)} h`;
}

function startXpTimer() {
  if (state.xpTimer) clearInterval(state.xpTimer);
  state.xpTimer = setInterval(() => {
    if (!state.currentUser) return;
    const uid = state.currentUser.uid;
    const userRef = ref(db, `users/${uid}`);
    get(userRef).then(snap => {
      const cur = snap.val() || {};
      const newXp = (cur.xp || 0) + 1;
      update(userRef, { xp: newXp, watchMinutes: (cur.watchMinutes || 0) + 1 });
    });
  }, 60000);
}

// ==========================================
// 9. INTERACTIONS CLÉS
// ==========================================
async function toggleFavorite(media, type) {
  if (!state.currentUser) { openAuthModal(); return; }
  const uid = state.currentUser.uid;
  const favRef = ref(db, `favorites/${uid}/${media.id}`);
  if (state.favorites[media.id]) {
    await remove(favRef);
    showToast("Retiré des favoris");
  } else {
    await set(favRef, { title: media.title.english || media.title.romaji, cover: media.coverImage.large, type });
    showToast("Ajouté aux favoris ❤️");
  }
}

async function toggleWatchlist(media, type) {
  if (!state.currentUser) { openAuthModal(); return; }
  const uid = state.currentUser.uid;
  const wRef = ref(db, `watchlist/${uid}/${media.id}`);
  if (state.watchlist[media.id]) {
    await remove(wRef);
    showToast("Retiré de votre liste");
  } else {
    await set(wRef, { title: media.title.english || media.title.romaji, cover: media.coverImage.large, type });
    showToast("Ajouté à la liste ✓");
  }
}

function openAuthModal() { document.getElementById("authModal")?.classList.add("open"); }
function closeAuthModal() { document.getElementById("authModal")?.classList.remove("open"); }

// Initialisation globale
document.addEventListener("DOMContentLoaded", () => {
  runSplashScreen();

  // Commutateurs VOSTFR / VF pour derniers épisodes
  document.getElementById("btnFilterEpVOSTFR")?.addEventListener("click", () => {
    state.latestEpLangFilter = "VOSTFR";
    document.getElementById("btnFilterEpVOSTFR").classList.add("active");
    document.getElementById("btnFilterEpVF").classList.remove("active");
    renderHomeView();
  });
  document.getElementById("btnFilterEpVF")?.addEventListener("click", () => {
    state.latestEpLangFilter = "VF";
    document.getElementById("btnFilterEpVF").classList.add("active");
    document.getElementById("btnFilterEpVOSTFR").classList.remove("active");
    renderHomeView();
  });

  // Logique de recherche ET / OU
  document.getElementById("btnLogicAND")?.addEventListener("click", () => {
    state.themeLogic = "AND";
    document.getElementById("btnLogicAND").classList.add("active");
    document.getElementById("btnLogicOR").classList.remove("active");
    document.getElementById("logicExplanation").textContent = "ET : chaque thème choisi doit être présent.";
    filterByThemes();
  });
  document.getElementById("btnLogicOR")?.addEventListener("click", () => {
    state.themeLogic = "OR";
    document.getElementById("btnLogicOR").classList.add("active");
    document.getElementById("btnLogicAND").classList.remove("active");
    document.getElementById("logicExplanation").textContent = "OU : au moins l'un des thèmes choisis doit être présent.";
    filterByThemes();
  });

  // Fermeture annonce News
  document.getElementById("btnCloseNewsBanner")?.addEventListener("click", () => {
    document.getElementById("newsAnnouncementBanner").style.display = "none";
  });

  // Recherche dans le header supérieur (FrAnime style)
  document.getElementById("topSearchBar")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = e.target.value.trim();
      if (q) window.location.hash = `#search?q=${encodeURIComponent(q)}`;
    }
  });

  // Drawer & popups
  document.getElementById("btnDrawerOpen")?.addEventListener("click", () => document.getElementById("sideDrawer")?.classList.add("open"));
  document.getElementById("btnDrawerClose")?.addEventListener("click", () => document.getElementById("sideDrawer")?.classList.remove("open"));
  document.getElementById("drawerOverlay")?.addEventListener("click", () => document.getElementById("sideDrawer")?.classList.remove("open"));
  document.getElementById("btnLoginTrigger")?.addEventListener("click", openAuthModal);
  document.getElementById("btnNoticeLogin")?.addEventListener("click", openAuthModal);
  document.getElementById("btnCloseAuthModal")?.addEventListener("click", closeAuthModal);
  document.getElementById("authModalBackdrop")?.addEventListener("click", closeAuthModal);

  // Auth Submit
  let isRegister = false;
  document.getElementById("tabAuthLogin")?.addEventListener("click", () => {
    isRegister = false;
    document.getElementById("tabAuthLogin").classList.add("active");
    document.getElementById("tabAuthRegister").classList.remove("active");
    document.getElementById("authUsernameGroup").style.display = "none";
  });
  document.getElementById("tabAuthRegister")?.addEventListener("click", () => {
    isRegister = true;
    document.getElementById("tabAuthRegister").classList.add("active");
    document.getElementById("tabAuthLogin").classList.remove("active");
    document.getElementById("authUsernameGroup").style.display = "block";
  });

  document.getElementById("authForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const em = document.getElementById("authEmailInput").value;
    const pw = document.getElementById("authPasswordInput").value;
    const un = document.getElementById("authUsernameInput")?.value;
    try {
      if (isRegister) {
        const c = await createUserWithEmailAndPassword(auth, em, pw);
        await set(ref(db, `users/${c.user.uid}`), { username: un || em.split("@")[0], email: em, role: "member", xp: 0 });
      } else {
        await signInWithEmailAndPassword(auth, em, pw);
      }
      closeAuthModal();
      showToast("Bienvenue sur Otaku-World !");
    } catch (err) {
      document.getElementById("authErrorMessage").textContent = err.message;
      document.getElementById("authErrorMessage").style.display = "block";
    }
  });

  document.getElementById("btnLogout")?.addEventListener("click", () => signOut(auth));

  // Écoute de l'Auth State
  onAuthStateChanged(auth, u => {
    state.currentUser = u;
    const notice = document.getElementById("guestHistoryNotice");
    if (notice) notice.style.display = u ? "none" : "flex";
    if (u) {
      onValue(ref(db, `users/${u.uid}`), s => { state.userProfile = s.val() || {}; });
      onValue(ref(db, `favorites/${u.uid}`), s => { state.favorites = s.val() || {}; });
      onValue(ref(db, `progress/${u.uid}`), s => { state.progress = s.val() || {}; renderContinueSection(); });
      onValue(ref(db, `watchlist/${u.uid}`), s => { state.watchlist = s.val() || {}; });
      onValue(ref(db, `history/${u.uid}`), s => { state.history = s.val() || {}; });
    }
  });

  // Boutons retour
  document.getElementById("btnBackFromDetail")?.addEventListener("click", () => window.history.back());
  document.getElementById("btnBackFromPlayer")?.addEventListener("click", () => window.history.back());
  document.getElementById("btnBackFromReader")?.addEventListener("click", () => window.history.back());

  navigateTo(window.location.hash);
});

// Initialisation automatique du système de thèmes au chargement
if (typeof initThemeSystem === 'function') {
  initThemeSystem();
}

// Raccourci clavier '/' pour la recherche
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    const searchBar = document.getElementById('topSearchBar');
    if (searchBar && window.getComputedStyle(searchBar.parentElement).display !== 'none') {
      searchBar.focus();
    } else {
      window.location.hash = '#search';
    }
  }
});
