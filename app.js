import { auth, db, storage } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  increment,
  query,
  orderByChild
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

const ANILIST_URL = "https://graphql.anilist.co";

const fallbackAnime = [
  ["Solo Leveling", "2024", "Action • Fantasy", "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=700&q=80"],
  ["Jujutsu Kaisen", "2020", "Action • Surnaturel", "https://images.unsplash.com/photo-1614583224978-f2a7a8b5f2d8?auto=format&fit=crop&w=700&q=80"],
  ["One Piece", "1999", "Aventure • Shōnen", "https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&w=700&q=80"],
  ["Demon Slayer", "2019", "Action • Fantasy", "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=700&q=80"]
];

const fallbackManga = [
  ["One Piece Manga", "1997", "Manga • Shōnen", "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=700&q=80"],
  ["Blue Lock", "2018", "Manga • Sport", "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=700&q=80"]
];

const extracts = [
  {
    title: "Aperçu libre 01",
    type: "Démo libre",
    duration: "00:30",
    img: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1000&q=80",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    desc: "Vidéo de démonstration libre de droits. Remplace-la par une bande-annonce officielle autorisée."
  },
  {
    title: "Aperçu libre 02",
    type: "Démo libre",
    duration: "00:25",
    img: "https://images.unsplash.com/photo-1614583224978-f2a7a8b5f2d8?auto=format&fit=crop&w=1000&q=80",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    desc: "Vidéo de démonstration sous licence CC0."
  }
];

const badges = [
  ["🌱", "Premier pas", 1],
  ["⏱️", "10 minutes", 10],
  ["🔥", "1 heure", 60],
  ["⭐", "5 heures", 300],
  ["👑", "Otaku confirmé", 1000]
];

let signup = false;
let currentUser = null;
let profile = null;
let sessionStart = 0;
let sessionType = "anime";
let activeMediaTitle = "";
let loadedResults = 0;
let currentSource = "anime";

const $ = (s) => document.querySelector(s);
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

// Navigation mobile & tiroir hamburger
function setupMenu() {
  const drawer = $("#drawer");
  const back = $("#drawerBackdrop");
  const open = () => { drawer.classList.add("open"); back.classList.remove("hidden"); };
  const close = () => { drawer.classList.remove("open"); back.classList.add("hidden"); };

  $("#menuBtn").onclick = open;
  $("#closeMenu").onclick = close;
  back.onclick = close;
  document.querySelectorAll("#drawer a").forEach((a) => (a.onclick = close));

  // Bottom nav sync
  document.querySelectorAll(".bottom-nav-item").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".bottom-nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });
}
setupMenu();

// Grilles de départ
function renderFallbackCards(list, containerId, type) {
  $(containerId).innerHTML = list.map((a, i) => `
    <article class="card fallback-card" data-i="${i}" data-type="${type}">
      <div class="poster-wrap">
        <img class="poster" src="${a[3]}" alt="${escapeHtml(a[0])}" loading="lazy">
        <span class="poster-score">Top</span>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(a[0])}</h3>
        <div class="meta">${escapeHtml(a[1])} • ${escapeHtml(a[2])}</div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(`${containerId} .fallback-card`).forEach((c) => {
    c.onclick = () => {
      const item = (c.dataset.type === "anime" ? fallbackAnime : fallbackManga)[Number(c.dataset.i)];
      openBasicDetail(item[0], item[1] + " • " + item[2], item[3], c.dataset.type);
    };
  });
}
renderFallbackCards(fallbackAnime, "#animeGrid", "anime");
renderFallbackCards(fallbackManga, "#mangaGrid", "manga");

// Extraits
function renderExtracts() {
  $("#extracts").innerHTML = extracts.map((e, i) => `
    <article class="extract" data-extract="${i}">
      <video muted preload="metadata" poster="${e.img}" src="${e.video}"></video>
      <div class="play-circle">▶</div>
      <div class="extract-overlay">
        <div>
          <h3>${escapeHtml(e.title)}</h3>
          <span>${escapeHtml(e.type)} • ${escapeHtml(e.duration)}</span>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".extract").forEach((x) => {
    x.onclick = () => openExtract(extracts[Number(x.dataset.extract)]);
  });
}
function openExtract(e) {
  $("#detailHero").innerHTML = `<img src="${e.img}" alt=""><div class="hero-gradient"></div>`;
  $("#detailTitle").textContent = e.title;
  $("#detailType").textContent = `${e.type} • ${e.duration}`;
  $("#detailDesc").textContent = e.desc;
  $("#detailScore").textContent = "APERÇU";
  $("#detailMeta").innerHTML = `<span class="chip">Aperçu officiel libre</span><span class="chip">Démo</span>`;
  $("#detailTrailerBox").classList.add("hidden");
  $("#seasonBox").classList.add("hidden");
  $("#detailNote").textContent = "Aucun flux payant ou protégé n'est contourné.";
  $("#detailSessionBtn").onclick = () => {
    $("#detailModal").classList.add("hidden");
    startSession(e.title, "anime");
  };
  $("#detailModal").classList.remove("hidden");
}
renderExtracts();

// AniList GraphQL Search avec filtres
async function anilistSearch({ keyword = "", type = "ANIME", genre = "", sort = "TRENDING_DESC" }) {
  const query = `
    query($search: String, $type: MediaType, $genre: String, $sort: [MediaSort], $adult: Boolean) {
      Page(perPage: 16) {
        media(search: $search, type: $type, genre: $genre, sort: $sort, isAdult: $adult) {
          id
          title { romaji english native userPreferred }
          coverImage { large }
          bannerImage
          description(asHtml: false)
          averageScore
          episodes
          chapters
          volumes
          status
          seasonYear
          genres
          studios(isMain: true) { nodes { name } }
          trailer { id site thumbnail }
          isAdult
        }
      }
    }
  `;

  const variables = {
    type,
    sort: [sort],
    adult: false
  };
  if (keyword) variables.search = keyword;
  if (genre) variables.genre = genre;

  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) throw new Error("AniList est temporairement indisponible.");
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "Erreur AniList");
  return (json.data?.Page?.media || []).filter((x) => !x.isAdult);
}

// MangaDex Search via Backend Proxy
async function mangaDexSearch(keyword) {
  const backend = (localStorage.getItem("backendBase") || "").replace(/\/$/, "");
  if (backend) {
    const r = await fetch(`${backend}/api/mangadex/search?q=${encodeURIComponent(keyword)}`);
    if (!r.ok) throw new Error("Backend MangaDex indisponible.");
    const j = await r.json();
    return j.data || [];
  }
  // Appel direct de secours pour l'exploration
  const url = `https://api.mangadex.org/manga?limit=14&contentRating[]=safe&contentRating[]=suggestive&title=${encodeURIComponent(keyword)}&includes[]=cover_art`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Active le backend MangaDex dans le Dashboard pour contourner les limitations CORS.");
  const j = await r.json();
  return j.data || [];
}

// Open Library Search pour Comics
async function openOpenLibrary(keyword) {
  const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=14&fields=key,title,author_name,cover_i,first_publish_year,subject`);
  if (!r.ok) throw new Error("Open Library indisponible.");
  const j = await r.json();
  return (j.docs || []).filter((x) => x.cover_i).map((x) => ({
    title: x.title || "Sans titre",
    cover: `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`,
    year: x.first_publish_year || "",
    authors: (x.author_name || []).slice(0, 2).join(", "),
    subject: (x.subject || []).slice(0, 3).join(" • ")
  }));
}

// Correspondance Anime-Sama
async function animeSamaSearch(title) {
  const base = (localStorage.getItem("animeSamaBase") || "http://127.0.0.1:5000").replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/api/search?q=${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

// Rendu des résultats AniList
function renderAniList(items) {
  loadedResults = items.length;
  $("#contentCount").textContent = loadedResults;

  if (items.length === 0) {
    $("#searchResults").innerHTML = `<p class="muted" style="grid-column: 1/-1; text-align: center; padding: 20px;">Aucun contenu trouvé avec ces filtres.</p>`;
    return;
  }

  $("#searchResults").innerHTML = items.map((a, i) => {
    const title = a.title.english || a.title.romaji || a.title.userPreferred || "Sans titre";
    const score = a.averageScore ? `${a.averageScore}%` : "N/A";
    const meta = a.seasonYear ? `${a.seasonYear} • ${a.episodes ? a.episodes + ' ép.' : (a.chapters ? a.chapters + ' chap.' : '')}` : "Catalogue";
    return `
      <article class="card ani-card" data-i="${i}">
        <div class="poster-wrap">
          <img class="poster" src="${a.coverImage?.large || ''}" alt="${escapeHtml(title)}" loading="lazy">
          <span class="poster-score">${score}</span>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(title)}</h3>
          <div class="meta">${meta}</div>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".ani-card").forEach((c) => {
    c.onclick = () => openAniListDetail(items[Number(c.dataset.i)]);
  });
}

// Fiche détaillée riche AniList
async function openAniListDetail(a) {
  const title = a.title.english || a.title.romaji || a.title.userPreferred;
  activeMediaTitle = title;

  $("#detailHero").innerHTML = `
    <img src="${a.bannerImage || a.coverImage?.large}" alt="${escapeHtml(title)}">
    <div class="hero-gradient"></div>
  `;
  $("#detailTitle").textContent = title;
  $("#detailType").textContent = `${a.status || 'EN COURS'} • ${a.seasonYear || 'ANNÉE INCONNUE'}`;
  $("#detailDesc").textContent = a.description ? a.description.replace(/<[^>]*>/g, "") : "Synopsis non renseigné.";
  $("#detailScore").textContent = a.averageScore ? `${a.averageScore}%` : "N/A";

  // Chips
  const studio = a.studios?.nodes?.[0]?.name;
  const chipsHtml = [
    a.episodes ? `<span class="chip">📺 ${a.episodes} épisodes</span>` : "",
    a.chapters ? `<span class="chip">📖 ${a.chapters} chapitres</span>` : "",
    studio ? `<span class="chip">🏢 ${escapeHtml(studio)}</span>` : "",
    ...(a.genres || []).map((g) => `<span class="chip">${escapeHtml(g)}</span>`)
  ].filter(Boolean).join("");
  $("#detailMeta").innerHTML = chipsHtml;

  // Trailer YouTube officiel autorisé
  if (a.trailer && a.trailer.site === "youtube" && a.trailer.id) {
    $("#detailTrailerBox").classList.remove("hidden");
    $("#trailerContainer").innerHTML = `
      <iframe src="https://www.youtube.com/embed/${a.trailer.id}?rel=0" allowfullscreen loading="lazy" title="Trailer"></iframe>
    `;
  } else {
    $("#detailTrailerBox").classList.add("hidden");
    $("#trailerContainer").innerHTML = "";
  }

  // Anime-Sama correspondence
  $("#seasonBox").classList.remove("hidden");
  $("#seasonList").innerHTML = `<small class="muted">Recherche des correspondances...</small>`;
  animeSamaSearch(title).then((results) => {
    if (results && results.length > 0) {
      $("#seasonList").innerHTML = results.map((r) => `
        <div style="padding: 6px 0; border-bottom: 1px solid #1a1a24; font-size: 12px; display: flex; justify-content: space-between;">
          <b>${escapeHtml(r.title || r.name)}</b>
          <span class="muted">${escapeHtml(r.type || "Saison")}</span>
        </div>
      `).join("");
    } else {
      $("#seasonList").innerHTML = `<small class="muted">Aucune saison trouvée sur votre instance AnimeSamaApi locale.</small>`;
    }
  });

  $("#detailNote").textContent = "Métadonnées issues d'AniList GraphQL. Respect des conditions de diffusion des ayants droit.";
  $("#detailSessionBtn").onclick = () => {
    $("#detailModal").classList.add("hidden");
    startSession(title, a.episodes ? "anime" : "manga");
  };

  $("#detailModal").classList.remove("hidden");
}

function openBasicDetail(title, desc, img, type) {
  activeMediaTitle = title;
  $("#detailHero").innerHTML = `<img src="${img}" alt=""><div class="hero-gradient"></div>`;
  $("#detailTitle").textContent = title;
  $("#detailType").textContent = type.toUpperCase();
  $("#detailDesc").textContent = desc;
  $("#detailScore").textContent = "TOP";
  $("#detailMeta").innerHTML = `<span class="chip">${escapeHtml(type)}</span><span class="chip">Sélection</span>`;
  $("#detailTrailerBox").classList.add("hidden");
  $("#seasonBox").classList.add("hidden");
  $("#detailNote").textContent = "Sélection locale d'Otaku-World.";
  $("#detailSessionBtn").onclick = () => {
    $("#detailModal").classList.add("hidden");
    startSession(title, type);
  };
  $("#detailModal").classList.remove("hidden");
}

// Fonction de recherche principale
async function performSearch() {
  const keyword = $("#searchInput").value.trim();
  const genre = $("#genreFilter").value;
  const sort = $("#sortFilter").value;

  $("#searchLoader").classList.remove("hidden");
  $("#searchResults").innerHTML = "";
  $("#apiStatus").textContent = "Chargement…";

  try {
    if (currentSource === "anime") {
      const items = await anilistSearch({ keyword, type: "ANIME", genre, sort });
      renderAniList(items);
      $("#apiStatus").textContent = `${items.length} animés trouvés`;
    } else if (currentSource === "manga") {
      const items = await anilistSearch({ keyword, type: "MANGA", genre, sort });
      renderAniList(items);
      $("#apiStatus").textContent = `${items.length} mangas trouvés`;
    } else if (currentSource === "webtoon") {
      const items = await anilistSearch({ keyword, type: "MANGA", genre, sort });
      const web = items.filter(
        (a) => (a.genres || []).some((g) => /webtoon|manhwa/i.test(g)) || /webtoon|manhwa/i.test(a.title.romaji || "")
      );
      renderAniList(web);
      $("#apiStatus").textContent = `${web.length} webtoons/manhwa`;
    } else {
      // Comics
      const items = await openOpenLibrary(keyword || "comics");
      $("#searchResults").innerHTML = items.map((a, i) => `
        <article class="card comic-card" data-i="${i}">
          <div class="poster-wrap">
            <img class="poster" src="${a.cover}" alt="${escapeHtml(a.title)}" loading="lazy">
            <span class="poster-score">${a.year || "Livre"}</span>
          </div>
          <div class="card-body">
            <h3>${escapeHtml(a.title)}</h3>
            <div class="meta">${escapeHtml(a.authors || "Auteur")}</div>
          </div>
        </article>
      `).join("");

      document.querySelectorAll(".comic-card").forEach((c) => {
        c.onclick = () => {
          const a = items[Number(c.dataset.i)];
          openBasicDetail(a.title, `${a.authors} • ${a.subject}`, a.cover, "comics");
        };
      });
      $("#apiStatus").textContent = `${items.length} comics trouvés`;
    }
  } catch (err) {
    $("#apiStatus").textContent = "Erreur source";
    $("#searchResults").innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 30px;">
        <p class="muted">${escapeHtml(err.message || "Erreur de chargement.")}</p>
        <button id="retrySearch" class="ghost small" style="margin-top: 10px;">Réessayer</button>
      </div>
    `;
    const retry = $("#retrySearch");
    if (retry) retry.onclick = performSearch;
  } finally {
    $("#searchLoader").classList.add("hidden");
  }
}

// Événements de recherche et filtres
$("#searchBtn").onclick = performSearch;
$("#searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") performSearch(); });
$("#genreFilter").onchange = performSearch;
$("#sortFilter").onchange = performSearch;

// Onglets de sources
document.querySelectorAll(".source-tab").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".source-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentSource = btn.dataset.source;
    performSearch();
  };
});

// Authentification & Profil Firebase
function openAuth() { $("#authModal").classList.remove("hidden"); }

function showProfile() {
  if (!currentUser || !profile) {
    $("#profileSection").classList.add("hidden");
    $("#profileBtn").textContent = "👤 Connexion";
    return;
  }
  $("#profileSection").classList.remove("hidden");
  $("#profileBtn").textContent = "🚪 Déconnexion";
  $("#username").textContent = profile.username || currentUser.email.split("@")[0];
  $("#avatarImg").src = profile.photoURL || "data:image/svg+xml;charset=UTF-8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' rx='50' fill='#211a2d'/><text x='50' y='62' text-anchor='middle' font-size='45'>👤</text></svg>");

  const role = profile.role || "member";
  const labels = {
    owner: ["OWNER", "owner"],
    admin: ["ADMIN", "admin"],
    moderator: ["MODÉRATEUR", "modo"],
    member: ["MEMBRE", "normal"]
  };
  const [label, cls] = labels[role] || labels.member;
  $("#roleBadge").textContent = label;
  $("#roleBadge").className = "role " + cls;

  const xp = profile.points || 0;
  const lvl = Math.floor(xp / 100) + 1;
  const currentLvlXp = xp % 100;

  $("#points").textContent = xp;
  $("#watchMin").textContent = profile.watchMin || 0;
  $("#readMin").textContent = profile.readMin || 0;
  $("#level").textContent = `Niveau ${lvl} • ${xp} XP`;
  $("#xpBar").style.width = currentLvlXp + "%";
  $("#nextLevel").textContent = `${100 - currentLvlXp} XP avant le niveau ${lvl + 1}`;

  // Badges
  $("#badges").innerHTML = badges.map((b) => `
    <div class="badge" style="opacity: ${xp >= b[2] ? 1 : 0.35}">
      ${b[0]} <b>${b[1]}</b>
    </div>
  `).join("");

  // Accès dashboard Owner/Admin
  const privileged = ["owner", "admin"].includes(role);
  $("#dashboardNav").classList.toggle("hidden", !privileged);
  if (privileged) {
    $("#backendBase").value = localStorage.getItem("backendBase") || "";
    $("#dashboardSection").classList.remove("hidden");
    $("#dashRole").textContent = role.toUpperCase();
    $("#dashRole").className = "role " + role;
    loadDashboardStats();
  } else {
    $("#dashboardSection").classList.add("hidden");
  }
}

async function loadProfile(user) {
  try {
    const snap = await get(ref(db, "users/" + user.uid));
    profile = snap.exists() ? snap.val() : null;
    if (!profile) {
      profile = {
        username: user.email.split("@")[0],
        role: "member",
        points: 0,
        watchMin: 0,
        readMin: 0,
        photoURL: ""
      };
      await set(ref(db, "users/" + user.uid), profile);
    }
    showProfile();
  } catch (e) {
    console.error("Erreur de profil:", e);
  }
}

async function loadDashboardStats() {
  try {
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const vals = Object.values(users);
    $("#userCount").textContent = vals.length;
    $("#totalXp").textContent = vals.reduce((n, u) => n + (u.points || 0), 0);
    $("#firebaseState").textContent = "OK";
  } catch {
    $("#firebaseState").textContent = "ERR";
  }
}

// Config Dashboard
$("#saveApi").onclick = () => {
  $("#adminMsg").textContent = "";
  localStorage.setItem("animeSamaBase", $("#animeSamaBase").value.trim().replace(/\/$/, ""));
  localStorage.setItem("backendBase", $("#backendBase").value.trim().replace(/\/$/, ""));
  $("#adminMsg").textContent = "Configuration enregistrée sur cet appareil !";
};
$("#refreshUsers").onclick = loadDashboardStats;
$("#testAnimeSama").onclick = async () => {
  try {
    const x = await animeSamaSearch("Frieren");
    $("#adminMsg").textContent = `AnimeSamaApi connectée (${x.length} résultats).`;
  } catch {
    $("#adminMsg").textContent = "AnimeSamaApi non joignable. Vérifiez l'URL.";
  }
};

// Avatar Upload
$("#avatarInput").onchange = async (e) => {
  if (!currentUser || !e.target.files[0]) return;
  const file = e.target.files[0];
  if (file.size > 2 * 1024 * 1024) {
    alert("Photo trop volumineuse (max 2 Mo).");
    return;
  }
  const path = storageRef(storage, `avatars/${currentUser.uid}/profile`);
  await uploadBytes(path, file);
  const url = await getDownloadURL(path);
  await update(ref(db, "users/" + currentUser.uid), { photoURL: url });
  await loadProfile(currentUser);
};

// Sessions & XP
function startSession(title, type) {
  if (!currentUser) {
    openAuth();
    return;
  }
  sessionStart = Date.now();
  sessionType = type;
  activeMediaTitle = title;
  $("#mediaType").textContent = type.toUpperCase();
  $("#mediaTitle").textContent = title;
  $("#watchModal").classList.remove("hidden");
}

async function finishSession() {
  if (!sessionStart || !currentUser) return;
  const mins = Math.floor((Date.now() - sessionStart) / 60000);
  sessionStart = 0;
  if (mins < 1) return;
  const updates = { points: increment(mins) };
  updates[sessionType === "anime" ? "watchMin" : "readMin"] = increment(mins);
  await update(ref(db, "users/" + currentUser.uid), updates);
  await loadProfile(currentUser);
}

// Actions Auth
$("#profileBtn").onclick = async () => {
  if (currentUser) await signOut(auth);
  else openAuth();
};
$("#logoutBtn").onclick = async () => signOut(auth);

$("#authAction").onclick = async () => {
  const email = $("#email").value.trim();
  const pass = $("#password").value;
  $("#authMsg").textContent = "";
  try {
    if (signup) await createUserWithEmailAndPassword(auth, email, pass);
    else await signInWithEmailAndPassword(auth, email, pass);
    $("#authModal").classList.add("hidden");
  } catch (e) {
    $("#authMsg").textContent = e.message;
  }
};

$("#switchAuth").onclick = () => {
  signup = !signup;
  $("#authTitle").textContent = signup ? "Créer un compte" : "Connexion";
  $("#authAction").textContent = signup ? "Créer le compte" : "Se connecter";
  $("#switchAuth").textContent = signup ? "J'ai déjà un compte" : "Créer un compte";
};

// Fermeture des modales
document.querySelectorAll("[data-close]").forEach((x) => {
  x.onclick = () => {
    if (x.closest("#watchModal")) finishSession();
    x.closest(".modal").classList.add("hidden");
  };
});

// Chronomètre de session
setInterval(() => {
  if (sessionStart) {
    const elapsed = Date.now() - sessionStart;
    $("#timer").textContent = new Date(elapsed).toISOString().substr(14, 5);
  }
}, 1000);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) await loadProfile(user);
  else {
    profile = null;
    showProfile();
  }
});

// Recherche initiale
performSearch();
