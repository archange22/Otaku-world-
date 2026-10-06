import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { ref, get, set, update, remove, onValue } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

/* ---------- État global ---------- */
const state = {
  user: null,
  profile: null,
  view: 'home',
  searchType: 'ANIME',
  libTab: 'favorites',
  library: { favorites: {}, watchlist: {}, history: {} },
  lastDetail: null
};

const ANILIST = 'https://graphql.anilist.co';

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function anilist(query, variables = {}) {
  const res = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error('AniList indisponible');
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

const CARD_FIELDS = `
  id title { romaji english } coverImage { extraLarge large color }
  bannerImage averageScore format seasonYear countryOfOrigin
`;

/* ---------- Rendu des cartes ---------- */
function mediaType(m) { return m.format && /MANGA|NOVEL|ONE_SHOT/.test(m.format) ? 'MANGA' : 'ANIME'; }

function cardHTML(m) {
  const title = m.title.romaji || m.title.english || 'Sans titre';
  const img = m.coverImage?.large || m.coverImage?.extraLarge || '';
  const sub = [m.format, m.seasonYear].filter(Boolean).join(' • ');
  return `
  <article class="card" data-id="${m.id}">
    <div class="card-poster">
      <img loading="lazy" src="${img}" alt="${title}">
      ${m.averageScore ? `<span class="card-score">★ ${(m.averageScore / 10).toFixed(1)}</span>` : ''}
    </div>
    <h3 class="card-title">${title}</h3>
    <span class="card-sub">${sub}</span>
  </article>`;
}

function bindCards(container, list) {
  container.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => {
      const m = list.find(x => String(x.id) === el.dataset.id);
      if (m) openDetail(m);
    });
  });
}

/* ---------- Hero ---------- */
function renderHero(m) {
  const hero = $('#hero');
  const bd = $('#heroBackdrop');
  bd.style.backgroundImage = `url(${m.bannerImage || m.coverImage?.extraLarge || ''})`;
  $('#heroContent').innerHTML = `
    <span class="hero-badge">${mediaType(m) === 'ANIME' ? 'Anime à la une' : 'Manga à la une'}</span>
    <h1 class="hero-title">${m.title.romaji || m.title.english}</h1>
    ${m.averageScore ? `<span class="card-sub">★ ${(m.averageScore / 10).toFixed(1)} / 10</span>` : ''}
    <p class="hero-desc">${m.description || ''}</p>
    <div class="hero-actions">
      <button class="btn-primary" id="heroWatch">▶ Regarder</button>
      <button class="btn-secondary" id="heroInfo">ℹ Plus d'infos</button>
    </div>`;
  $('#heroWatch').onclick = () => openDetail(m);
  $('#heroInfo').onclick = () => openDetail(m);
}

/* ---------- Rangées d'accueil ---------- */
function rowHTML(title, id) {
  return `<section class="feed-row">
    <div class="feed-head"><h2 class="feed-title">${title}</h2></div>
    <div class="feed-scroll" id="${id}"></div>
  </section>`;
}

function fillRow(id, list) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = list.map(cardHTML).join('');
  bindCards(el, list);
}

async function loadHome() {
  const feed = $('#feed');
  feed.innerHTML = rowHTML('Tendances cette semaine', 'rowTrending') +
    rowHTML('Animes populaires', 'rowPopular') +
    rowHTML('Manga populaires', 'rowManga') +
    rowHTML('Sorties récentes', 'rowRecent');
  try {
    const [trending, popular, manga] = await Promise.all([
      anilist(`query { Page(perPage: 18) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${CARD_FIELDS} } } }`),
      anilist(`query { Page(perPage: 18) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${CARD_FIELDS} } } }`),
      anilist(`query { Page(perPage: 18) { media(type: MANGA, sort: POPULARITY_DESC, isAdult: false) { ${CARD_FIELDS} } } }`)
    ]);
    const t = trending.Page.media, p = popular.Page.media, g = manga.Page.media;
    renderHero(t[0]);
    fillRow('rowTrending', t);
    fillRow('rowPopular', p);
    fillRow('rowManga', g);
    const recent = anilist(`query { Page(perPage: 18) { media(type: ANIME, sort: START_DATE_DESC, isAdult: false, status: RELEASING) { ${CARD_FIELDS} } } }`);
    fillRow('rowRecent', (await recent).Page.media);
  } catch (e) {
    feed.innerHTML = `<div class="empty">Impossible de charger le catalogue : ${e.message}.<br>Vérifie ta connexion puis réessaie.</div>`;
  }
}

/* ---------- Recherche ---------- */
let searchTimer;
function bindSearch() {
  $('#searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 450);
  });
  $$('#searchChips .chip').forEach(c => c.addEventListener('click', () => {
    $$('#searchChips .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.searchType = c.dataset.type;
    runSearch();
  }));
}

async function runSearch() {
  const q = $('#searchInput').value.trim();
  const grid = $('#searchGrid'), empty = $('#searchEmpty');
  if (q.length < 2) { grid.innerHTML = ''; empty.hidden = true; return; }
  grid.innerHTML = Array(8).fill('<div class="card"><div class="card-poster skeleton"></div><div class="skeleton" style="height:14px;margin-top:6px"></div></div>').join('');
  empty.hidden = true;
  try {
    const data = await anilist(`query ($s: String, $t: MediaType) { Page(perPage: 24) { media(search: $s, type: $t, isAdult: false) { ${CARD_FIELDS} } } }`, { s: q, t: state.searchType });
    const list = data.Page.media;
    grid.innerHTML = list.map(cardHTML).join('') || '';
    bindCards(grid, list);
    if (!list.length) { empty.hidden = false; empty.textContent = 'Aucun résultat pour cette recherche.'; }
  } catch (e) {
    grid.innerHTML = '';
    empty.hidden = false;
    empty.textContent = 'Erreur de recherche : ' + e.message;
  }
}

/* ---------- Fiche détaillée ---------- */
async function openDetail(m) {
  state.lastDetail = m;
  $('#detailView').hidden = false;
  $('#main').hidden = true;
  window.scrollTo(0, 0);
  const c = $('#detailContent');
  c.innerHTML = '<div class="skeleton skel-hero-line"></div><div class="skeleton skel-hero-line" style="margin-top:8px"></div>';
  try {
    const data = await anilist(`query ($id: Int) { Media(id: $id) {
      ${CARD_FIELDS} description(asHtml: false) genres episodes chapters volumes status
      trailer { id site } externalLinks { site url }
      characters(perPage: 8) { nodes { name { full } image { medium } } }
    } }`, { id: m.id });
    renderDetail(data.Media);
  } catch (e) {
    renderDetail(m);
  }
}

function renderDetail(m) {
  const title = m.title.romaji || m.title.english;
  const c = $('#detailContent');
  const actions = state.user ? `
    <div class="hero-actions">
      <button class="btn-primary" id="dFav">♥ Favori</button>
      <button class="btn-secondary" id="dWatchlist">＋ À regarder</button>
    </div>` : `<p class="card-sub">Connecte-toi pour ajouter à tes listes.</p>`;
  c.innerHTML = `
    <div class="hero" style="height:40vh;min-height:280px">
      <div class="hero-backdrop" style="background-image:url(${m.bannerImage || m.coverImage?.extraLarge || ''})"></div>
      <div class="hero-fade"></div>
      <div class="hero-content">
        <h1 class="hero-title" style="font-size:clamp(22px,5vw,36px)">${title}</h1>
        <span class="card-sub">${[m.format, m.seasonYear, m.status].filter(Boolean).join(' • ')} ${m.averageScore ? `• ★ ${(m.averageScore / 10).toFixed(1)}` : ''}</span>
        ${actions}
      </div>
    </div>
    <div style="padding:16px">
      <p class="hero-desc" style="-webkit-line-clamp:unset">${m.description || 'Synopsis indisponible.'}</p>
      ${m.genres?.length ? `<div class="chip-row">${m.genres.map(g => `<span class="chip">${g}</span>`).join('')}</div>` : ''}
      ${m.trailer?.site === 'youtube' ? `
        <h3 class="page-title" style="margin-top:20px;font-size:16px">Bande-annonce</h3>
        <iframe style="width:100%;aspect-ratio:16/9;border:none;border-radius:14px" src="https://www.youtube-nocookie.com/embed/${m.trailer.id}" allowfullscreen loading="lazy"></iframe>` : ''}
      ${m.characters?.nodes?.length ? `
        <h3 class="page-title" style="margin-top:20px;font-size:16px">Personnages</h3>
        <div class="feed-scroll">${m.characters.nodes.map(ch => `
          <div class="card" style="flex:0 0 90px">
            <div class="card-poster" style="aspect-ratio:1"><img loading="lazy" src="${ch.image?.medium || ''}" alt=""></div>
            <span class="card-sub">${ch.name.full}</span>
          </div>`).join('')}</div>` : ''}
      ${m.externalLinks?.length ? `
        <h3 class="page-title" style="margin-top:20px;font-size:16px">Regarder / lire (officiel)</h3>
        <div class="chip-row">${m.externalLinks.filter(l => l.url).map(l => `<a class="chip" style="text-decoration:none" href="${l.url}" target="_blank" rel="noopener">${l.site}</a>`).join('')}</div>` : ''}
    </div>`;
  if (state.user) {
    c.querySelector('#dFav').onclick = () => toggleList('favorites', m);
    c.querySelector('#dWatchlist').onclick = () => toggleList('watchlist', m);
  }
}

/* ---------- Bibliothèque (Firebase RTDB) ---------- */
async function toggleList(list, m) {
  if (!state.user) return toast('Connecte-toi d\u2019abord');
  const uid = state.user.uid;
  const key = `${mediaType(m)}-${m.id}`;
  const node = ref(db, `${list}/${uid}/${key}`);
  if (state.library[list]?.[key]) {
    await remove(node);
    toast('Retiré de ' + list);
  } else {
    await set(node, {
      id: m.id, type: mediaType(m), title: m.title.romaji || m.title.english,
      cover: m.coverImage?.large || '', score: m.averageScore || null,
      format: m.format || null, year: m.seasonYear || null, addedAt: Date.now()
    });
    toast('Ajouté à ' + list);
  }
}

function watchLibrary() {
  if (!state.user) return;
  ['favorites', 'watchlist', 'history'].forEach(list => {
    onValue(ref(db, `${list}/${state.user.uid}`), snap => {
      state.library[list] = snap.val() || {};
      if (state.view === 'library') renderLibrary();
    });
  });
}

function renderLibrary() {
  const grid = $('#libraryGrid'), empty = $('#libraryEmpty');
  const entries = Object.entries(state.library[state.libTab] || {});
  if (!entries.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    empty.textContent = state.user ? 'Cette liste est vide.' : 'Connecte-toi pour voir ta bibliothèque.';
    return;
  }
  empty.hidden = true;
  grid.innerHTML = entries.map(([key, v]) => `
    <article class="card" data-key="${key}">
      <div class="card-poster"><img loading="lazy" src="${v.cover || ''}" alt="${v.title}">
      ${v.score ? `<span class="card-score">★ ${(v.score / 10).toFixed(1)}</span>` : ''}</div>
      <h3 class="card-title">${v.title}</h3>
      <span class="card-sub">${[v.format, v.year].filter(Boolean).join(' • ')}</span>
    </article>`).join('');
  grid.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => {
      const [, v] = entries.find(([k]) => k === el.dataset.key);
      openDetail({ id: v.id, title: { romaji: v.title, english: v.title }, coverImage: { large: v.cover, extraLarge: v.cover }, averageScore: v.score, format: v.format, seasonYear: v.year });
    });
  });
}

/* ---------- Navigation / vues ---------- */
const VIEWS = ['home', 'search', 'library', 'calendar', 'profile'];

function showView(v) {
  state.view = v;
  $('#main').hidden = v !== 'home';
  $('#searchView').hidden = v !== 'search';
  $('#libraryView').hidden = v !== 'library';
  $('#detailView').hidden = true;
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === v));
  if (v === 'search') setTimeout(() => $('#searchInput').focus(), 150);
  if (v === 'library') renderLibrary();
  if (v === 'calendar') $('#main').hidden = true;
  if (v !== 'home') window.scrollTo(0, 0);
}

function bindNav() {
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); showView(nav.dataset.nav); }
    const close = e.target.closest('[data-close]');
    if (close) close.closest('.modal').hidden = true;
  });
  $('#btnBackDetail').addEventListener('click', () => {
    $('#detailView').hidden = true;
    $('#main').hidden = state.view !== 'home';
  });
  $('#btnSearch').addEventListener('click', () => showView('search'));
  $$('#libTabs .chip').forEach(c => c.addEventListener('click', () => {
    $$('#libTabs .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.libTab = c.dataset.list;
    renderLibrary();
  }));
}

/* ---------- Authentification ---------- */
let authMode = 'login';
function bindAuth() {
  $('#btnProfile').addEventListener('click', () => {
    if (state.user) {
      if (confirm('Se déconnecter ?')) signOut(auth);
    } else {
      $('#authModal').hidden = false;
    }
  });
  $('#btnAuthMode').addEventListener('click', e => {
    e.preventDefault();
    authMode = authMode === 'login' ? 'signup' : 'login';
    $('#authTitle').textContent = authMode === 'login' ? 'Connexion' : 'Créer un compte';
    $('#authSubmit').textContent = authMode === 'login' ? 'Se connecter' : 'Créer le compte';
    $('#authSwitch').innerHTML = authMode === 'login'
      ? 'Pas de compte ? <a href="#" id="btnAuthMode">Créer un compte</a>'
      : 'Déjà un compte ? <a href="#" id="btnAuthMode">Se connecter</a>';
    $('#btnAuthMode').addEventListener('click', arguments.callee ? (ev) => { ev.preventDefault(); $('#authModal').hidden = true; setTimeout(() => $('#btnProfile').click(), 10); } : null);
  });
  $('#authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#authError');
    err.hidden = true;
    try {
      const email = $('#authEmail').value, pass = $('#authPass').value;
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, pass);
      else await createUserWithEmailAndPassword(auth, email, pass);
      $('#authModal').hidden = true;
      toast('Bienvenue !');
    } catch (ex) {
      err.textContent = ex.code === 'auth/invalid-credential' ? 'Email ou mot de passe incorrect.'
        : ex.code === 'auth/email-already-in-use' ? 'Cet email est déjà utilisé.'
        : ex.message;
      err.hidden = false;
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    $('#navAvatar').src = user.photoURL || $('#navAvatar').src;
    await set(ref(db, `users/${user.uid}/profile`), {
      email: user.email, username: user.displayName || user.email.split('@')[0], updatedAt: Date.now()
    }, { merge: true }).catch(() => {});
    watchLibrary();
    toast('Connecté : ' + (user.displayName || user.email));
  } else {
    state.library = { favorites: {}, watchlist: {}, history: {} };
    renderLibrary();
  }
});

/* ---------- Boot ---------- */
window.addEventListener('DOMContentLoaded', () => {
  bindNav();
  bindSearch();
  bindAuth();
  loadHome();
  setTimeout(() => $('#splash').classList.add('hidden'), 600);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
