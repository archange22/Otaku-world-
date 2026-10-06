/* KOVA — listes Anime (AniList) + Manga (MangaDex). Sans dépendance.
   Usage : KovaCatalog.mount(document.querySelector('[data-kova-catalog]'));
   Un clic sur une carte déclenche l'événement "kova:open" (detail: {source, id, title}). */
(function () {
  const ANILIST = 'https://graphql.anilist.co';
  // Si le navigateur bloque MangaDex (erreur CORS), définis window.KOVA_MANGADEX_PROXY avant ce script.
  const MANGADEX = window.KOVA_MANGADEX_PROXY || 'https://api.mangadex.org';
  const PER_PAGE = 24;

  const CSS = `
.kc{color:#e8e8f2;font-family:inherit}
.kc-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.kc-tab{padding:8px 16px;border-radius:999px;border:1px solid #2a2d45;background:transparent;color:inherit;cursor:pointer;font:inherit}
.kc-tab[aria-pressed=true]{background:#8b5cf6;border-color:#8b5cf6;color:#fff}
.kc-search{flex:1 1 180px;min-width:0;padding:8px 14px;border-radius:999px;border:1px solid #2a2d45;background:#10121c;color:inherit;font:inherit}
.kc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px}
.kc-card{display:block;color:inherit;text-decoration:none}
.kc-cover{position:relative;aspect-ratio:2/3;border-radius:10px;overflow:hidden;background:#10121c}
.kc-cover img{width:100%;height:100%;object-fit:cover;display:block}
.kc-score{position:absolute;top:6px;left:6px;padding:2px 6px;border-radius:6px;background:rgba(7,8,15,.85);font-size:12px}
.kc-title{margin-top:6px;font-size:14px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.kc-meta{font-size:12px;opacity:.6;margin-top:2px}
.kc-status{padding:24px 0;text-align:center;opacity:.85}
.kc-btn{display:block;margin:20px auto 0;padding:10px 22px;border-radius:999px;border:1px solid #8b5cf6;background:transparent;color:inherit;cursor:pointer;font:inherit}
.kc :is(button,input,a):focus-visible{outline:2px solid #a78bfa;outline-offset:2px}`;

  function injectCss() {
    if (document.getElementById('kc-style')) return;
    const s = document.createElement('style');
    s.id = 'kc-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') n.className = v;
      else n.setAttribute(k, v);
    }
    kids.flat().filter(Boolean).forEach((k) => n.append(k));
    return n;
  }

  /* ---------- Sources de données ---------- */

  async function fetchAnime({ page, search }) {
    const sort = search ? 'SEARCH_MATCH' : 'TRENDING_DESC';
    const query = `query($page:Int,$perPage:Int,$search:String){
      Page(page:$page,perPage:$perPage){
        pageInfo{hasNextPage}
        media(type:ANIME,search:$search,sort:[${sort}],isAdult:false){
          id title{romaji english} coverImage{large} averageScore format episodes
        }
      }
    }`;
    const variables = { page, perPage: PER_PAGE };
    if (search) variables.search = search;
    const res = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error('AniList ' + res.status);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    const p = json.data.Page;
    return {
      hasMore: p.pageInfo.hasNextPage,
      items: p.media.map((m) => ({
        source: 'anilist',
        id: m.id,
        title: m.title.english || m.title.romaji,
        cover: m.coverImage.large,
        score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
        meta: [m.format, m.episodes ? m.episodes + ' ép.' : null].filter(Boolean).join(' • '),
      })),
    };
  }

  async function fetchManga({ page, search }) {
    const offset = (page - 1) * PER_PAGE;
    const p = new URLSearchParams();
    p.set('limit', PER_PAGE);
    p.set('offset', offset);
    p.set('hasAvailableChapters', 'true');
    p.append('includes[]', 'cover_art');
    ['safe', 'suggestive'].forEach((v) => p.append('contentRating[]', v));
    ['fr', 'en'].forEach((v) => p.append('availableTranslatedLanguage[]', v));
    if (search) p.set('title', search);
    else p.set('order[followedCount]', 'desc');
    const res = await fetch(`${MANGADEX}/manga?${p}`);
    if (!res.ok) throw new Error('MangaDex ' + res.status);
    const json = await res.json();
    return {
      hasMore: offset + PER_PAGE < json.total,
      items: json.data.map((m) => {
        const t = m.attributes.title || {};
        const file = (m.relationships.find((r) => r.type === 'cover_art') || {}).attributes;
        return {
          source: 'mangadex',
          id: m.id,
          title: t.en || t['ja-ro'] || Object.values(t)[0] || 'Sans titre',
          cover: file && file.fileName ? `https://uploads.mangadex.org/covers/${m.id}/${file.fileName}.256.jpg` : null,
          score: null,
          meta: [m.attributes.year, m.attributes.status].filter(Boolean).join(' • '),
        };
      }),
    };
  }

  const SOURCES = { anime: fetchAnime, manga: fetchManga };

  /* ---------- Interface ---------- */

  function mount(root, opts) {
    if (!root) return;
    injectCss();
    const state = { tab: (opts && opts.tab) || 'anime', page: 1, search: '', run: 0 };

    root.textContent = '';
    root.classList.add('kc');

    const tabs = { anime: el('button', { class: 'kc-tab', type: 'button' }, 'Anime'), manga: el('button', { class: 'kc-tab', type: 'button' }, 'Manga') };
    const input = el('input', { class: 'kc-search', type: 'search', placeholder: 'Rechercher un titre', 'aria-label': 'Rechercher un titre' });
    const grid = el('div', { class: 'kc-grid' });
    const status = el('div', { class: 'kc-status', role: 'status' });
    const more = el('button', { class: 'kc-btn', type: 'button', hidden: '' }, 'Charger plus');
    root.append(el('div', { class: 'kc-bar' }, tabs.anime, tabs.manga, input), grid, status, more);

    function card(it) {
      const a = el(
        'a',
        { class: 'kc-card', href: '#', title: it.title },
        el('div', { class: 'kc-cover' }, it.cover && el('img', { src: it.cover, alt: it.title, loading: 'lazy' }), it.score && el('span', { class: 'kc-score' }, '★ ' + it.score)),
        el('div', { class: 'kc-title' }, it.title),
        it.meta && el('div', { class: 'kc-meta' }, it.meta)
      );
      a.addEventListener('click', (e) => {
        e.preventDefault();
        root.dispatchEvent(new CustomEvent('kova:open', { bubbles: true, detail: { source: it.source, id: it.id, title: it.title } }));
      });
      return a;
    }

    async function load(reset) {
      if (reset) {
        state.page = 1;
        grid.textContent = '';
      }
      const run = ++state.run;
      more.hidden = true;
      status.textContent = 'Chargement…';
      try {
        const { items, hasMore } = await SOURCES[state.tab]({ page: state.page, search: state.search });
        if (run !== state.run) return; // une requête plus récente a pris le relais
        items.forEach((it) => grid.append(card(it)));
        status.textContent = !grid.children.length ? (state.search ? `Aucun résultat pour « ${state.search} ».` : 'Aucune œuvre à afficher.') : '';
        more.hidden = !hasMore;
      } catch (err) {
        if (run !== state.run) return;
        status.textContent = 'Impossible de charger la liste (' + err.message + '). ';
        const retry = el('button', { class: 'kc-btn', type: 'button' }, 'Réessayer');
        retry.addEventListener('click', () => load(false));
        status.append(retry);
      }
    }

    function setTab(tab) {
      state.tab = tab;
      Object.entries(tabs).forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === tab)));
      load(true);
    }

    tabs.anime.addEventListener('click', () => setTab('anime'));
    tabs.manga.addEventListener('click', () => setTab('manga'));
    more.addEventListener('click', () => {
      state.page += 1;
      load(false);
    });
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.search = input.value.trim();
        load(true);
      }, 400);
    });

    setTab(state.tab);
  }

  window.KovaCatalog = { mount };
  document.addEventListener('DOMContentLoaded', () => {
    const auto = document.querySelector('[data-kova-catalog]');
    if (auto && !auto.classList.contains('kc')) mount(auto);
  });
})();
