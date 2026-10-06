/**
 * Otaku-World — MangaDex Adapter v1.0
 * Module coupe-feu indépendant pour l'API MangaDex (https://api.mangadex.org)
 * Garantit la stabilité du catalogue même en cas d'évolution de l'API source.
 */

const MANGADEX_API_BASE = 'https://api.mangadex.org';
const MANGADEX_COVERS_BASE = 'https://uploads.mangadex.org/covers';

export class MangaDexAdapter {
  constructor(options = {}) {
    this.apiBase = options.apiBase || MANGADEX_API_BASE;
    this.coversBase = options.coversBase || MANGADEX_COVERS_BASE;
    this.timeout = options.timeout || 10000;
  }

  /**
   * Détermine le type précis (manga, manhwa, manhua ou unknown)
   */
  deduceType(originalLanguage) {
    switch (originalLanguage) {
      case 'ja': return 'manga';
      case 'ko': return 'manhwa';
      case 'zh':
      case 'zh-hk': return 'manhua';
      default: return 'unknown';
    }
  }

  /**
   * Normalise le score sur 10 sans présumer d'une vérité absolue
   */
  normalizeScore(stats) {
    if (!stats || !stats.rating) {
      return { value: null, source: 'mangadex', raw: null };
    }
    const raw = stats.rating.bayesian || stats.rating.average || null;
    const value = raw ? Math.round(raw * 10) / 10 : null;
    return {
      value,
      source: 'mangadex',
      raw
    };
  }

  /**
   * Extrait le meilleur titre selon la langue préférée
   */
  extractTitle(attributes) {
    const titleObj = attributes.title || {};
    const altTitles = attributes.altTitles || [];
    
    // Titre principal
    const mainTitle = titleObj.fr || titleObj.en || Object.values(titleObj)[0] || 'Titre inconnu';

    let frTitle = titleObj.fr || null;
    let enTitle = titleObj.en || null;
    let romajiTitle = titleObj['ja-ro'] || null;

    for (const alt of altTitles) {
      if (!frTitle && alt.fr) frTitle = alt.fr;
      if (!enTitle && alt.en) enTitle = alt.en;
      if (!romajiTitle && alt['ja-ro']) romajiTitle = alt['ja-ro'];
      if (!romajiTitle && alt.ja) romajiTitle = alt.ja;
    }

    return {
      display: frTitle || enTitle || mainTitle,
      fr: frTitle,
      en: enTitle,
      original: romajiTitle || mainTitle
    };
  }

  /**
   * Extrait le synopsis avec repli automatique FR -> EN
   */
  extractSynopsis(attributes) {
    const desc = attributes.description || {};
    if (desc.fr && desc.fr.trim().length > 0) {
      return { text: desc.fr, lang: 'fr' };
    }
    if (desc.en && desc.en.trim().length > 0) {
      return { text: desc.en, lang: 'en' };
    }
    const firstAvailable = Object.entries(desc)[0];
    if (firstAvailable) {
      return { text: firstAvailable[1], lang: firstAvailable[0] };
    }
    return { text: 'Aucun synopsis disponible pour le moment.', lang: null };
  }

  /**
   * Transforme un objet Manga MangaDex brut en modèle normalisé Otaku-World
   */
  normalizeManga(rawItem, stats = {}) {
    const attrs = rawItem.attributes || {};
    const relationships = rawItem.relationships || [];

    // Récupérer le nom de fichier de couverture
    const coverRel = relationships.find(r => r.type === 'cover_art');
    const coverFileName = coverRel?.attributes?.fileName || null;
    const coverUrl = coverFileName 
      ? `${this.coversBase}/${rawItem.id}/${coverFileName}.512.jpg`
      : null;

    // Récupérer auteur(s) et artiste(s)
    const authors = relationships
      .filter(r => r.type === 'author')
      .map(r => r.attributes?.name)
      .filter(Boolean);
    const artists = relationships
      .filter(r => r.type === 'artist')
      .map(r => r.attributes?.name)
      .filter(Boolean);

    // Extraction des tags / genres
    const tags = (attrs.tags || []).map(t => ({
      id: t.id,
      name: t.attributes?.name?.en || t.attributes?.name?.fr || 'Genre'
    }));

    return {
      id: rawItem.id,
      mediaType: 'MANGA',
      type: this.deduceType(attrs.originalLanguage),
      originalLanguage: attrs.originalLanguage || 'unknown',
      title: this.extractTitle(attrs),
      coverUrl,
      synopsis: this.extractSynopsis(attrs),
      status: attrs.status || 'unknown', // ongoing, completed, hiatus, cancelled
      year: attrs.year || (attrs.createdAt ? new Date(attrs.createdAt).getFullYear() : null),
      score: this.normalizeScore(stats[rawItem.id]),
      demographic: attrs.publicationDemographic || 'seinen',
      genres: tags,
      authors,
      artists,
      contentRating: attrs.contentRating || 'safe',
      lastVolume: attrs.lastVolume || null,
      lastChapter: attrs.lastChapter || null,
      source: 'mangadex'
    };
  }

  /**
   * Récupère les statistiques (scores) pour une liste d'IDs
   */
  async fetchStatistics(mangaIds = []) {
    if (!mangaIds.length) return {};
    try {
      const params = mangaIds.map(id => `manga[]=${encodeURIComponent(id)}`).join('&');
      const res = await fetch(`${this.apiBase}/statistics/manga?${params}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return {};
      const data = await res.json();
      return data.statistics || {};
    } catch (e) {
      console.warn('[MangaDexAdapter] Erreur récupération statistiques:', e);
      return {};
    }
  }

  /**
   * Recherche et catalogue manga avec filtres combinables et pagination
   */
  async getCatalogue({
    query = '',
    genres = [],
    demographic = [],
    status = [],
    originalLanguage = null,
    sort = 'followedCount',
    sortOrder = 'desc',
    limit = 24,
    page = 1,
    contentRating = ['safe']
  } = {}) {
    const offset = Math.max(0, (page - 1) * limit);
    const params = new URLSearchParams();

    params.append('limit', String(limit));
    params.append('offset', String(offset));
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');

    for (const r of contentRating) {
      params.append('contentRating[]', r);
    }

    if (query && query.trim()) {
      params.append('title', query.trim());
    }

    // Filtres combinables
    if (Array.isArray(genres)) {
      for (const g of genres) {
        if (g) params.append('includedTags[]', g);
      }
    }

    if (Array.isArray(demographic)) {
      for (const d of demographic) {
        if (d && d !== 'ALL') params.append('publicationDemographic[]', d.toLowerCase());
      }
    }

    if (Array.isArray(status)) {
      for (const s of status) {
        if (s && s !== 'ALL') params.append('status[]', s.toLowerCase());
      }
    } else if (status && status !== 'ALL') {
      params.append('status[]', status.toLowerCase());
    }

    // Filtre par langue d'origine (type : manga = ja, manhwa = ko, manhua = zh)
    if (originalLanguage) {
      if (Array.isArray(originalLanguage)) {
        for (const ol of originalLanguage) params.append('originalLanguage[]', ol);
      } else if (originalLanguage !== 'ALL') {
        params.append('originalLanguage[]', originalLanguage);
      }
    }

    // Gestion du tri MangaDex
    if (sort === 'rating') {
      params.append('order[rating]', sortOrder);
    } else if (sort === 'latest') {
      params.append('order[latestUploadedChapter]', sortOrder);
    } else if (sort === 'title') {
      params.append('order[title]', sortOrder === 'desc' ? 'desc' : 'asc');
    } else if (sort === 'year') {
      params.append('order[year]', sortOrder);
    } else {
      params.append('order[followedCount]', sortOrder);
    }

    const url = `${this.apiBase}/manga?${params.toString()}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      throw new Error(`MangaDex API error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const items = data.data || [];
    const total = data.total || 0;

    // Récupération des stats (score) pour enrichir
    const ids = items.map(m => m.id);
    const stats = await this.fetchStatistics(ids);

    const normalized = items.map(raw => this.normalizeManga(raw, stats));

    return {
      items: normalized,
      total,
      page,
      limit,
      hasMore: offset + items.length < total
    };
  }

  /**
   * Récupère la liste des chapitres avec logique intelligente FR -> EN
   */
  async getFeed(mangaId, { limit = 100, offset = 0 } = {}) {
    // 1. Tenter de charger les chapitres FR
    const paramsFr = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'translatedLanguage[]': 'fr',
      'order[chapter]': 'desc',
      'includes[]': 'scanlation_group'
    });

    const resFr = await fetch(`${this.apiBase}/manga/${mangaId}/feed?${paramsFr.toString()}`);
    let dataFr = resFr.ok ? await resFr.json() : { data: [], total: 0 };

    if (dataFr.data && dataFr.data.length > 0) {
      return {
        chapters: dataFr.data.map(ch => ({
          id: ch.id,
          chapter: ch.attributes?.chapter || '1',
          title: ch.attributes?.title || `Chapitre ${ch.attributes?.chapter || ''}`,
          language: 'fr',
          isFallbackLanguage: false,
          publishAt: ch.attributes?.publishAt || ch.attributes?.createdAt,
          pages: ch.attributes?.pages || 0,
          externalUrl: ch.attributes?.externalUrl || null
        })),
        language: 'fr',
        total: dataFr.total
      };
    }

    // 2. Repli vers EN si aucun chapitre FR n'est disponible
    const paramsEn = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'translatedLanguage[]': 'en',
      'order[chapter]': 'desc',
      'includes[]': 'scanlation_group'
    });

    const resEn = await fetch(`${this.apiBase}/manga/${mangaId}/feed?${paramsEn.toString()}`);
    const dataEn = resEn.ok ? await resEn.json() : { data: [], total: 0 };

    return {
      chapters: (dataEn.data || []).map(ch => ({
        id: ch.id,
        chapter: ch.attributes?.chapter || '1',
        title: ch.attributes?.title || `Chapter ${ch.attributes?.chapter || ''}`,
        language: 'en',
        isFallbackLanguage: true,
        publishAt: ch.attributes?.publishAt || ch.attributes?.createdAt,
        pages: ch.attributes?.pages || 0,
        externalUrl: ch.attributes?.externalUrl || null
      })),
      language: 'en',
      total: dataEn.total
    };
  }


  /**
   * Récupère les détails complets d'un manga par son ID
   */
  async getMangaDetails(mangaId) {
    const url = `${this.apiBase}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Manga non trouvé (statut ${res.status})`);
    const data = await res.json();
    const stats = await this.fetchStatistics([mangaId]);
    return this.normalizeManga(data.data, stats);
  }

  /**
   * Récupère les pages officielles d'un chapitre via l'infrastructure autorisée MangaDex At-Home
   * Supporte le mode haute qualité et le mode économie de données (dataSaver)
   */
  async getChapterPages(chapterId, { dataSaver = false } = {}) {
    const res = await fetch(`${this.apiBase}/at-home/server/${chapterId}`);
    if (!res.ok) throw new Error(`Erreur serveur MangaDex At-Home: ${res.status}`);
    const data = await res.json();
    const baseUrl = data.baseUrl;
    const hash = data.chapter?.hash;
    const fileNames = dataSaver ? (data.chapter?.dataSaver || []) : (data.chapter?.data || []);
    const subPath = dataSaver ? 'data-saver' : 'data';

    const pages = fileNames.map((fn, idx) => ({
      index: idx + 1,
      fileName: fn,
      url: `${baseUrl}/${subPath}/${hash}/${fn}`
    }));

    return {
      chapterId,
      hash,
      total: pages.length,
      pages,
      isDataSaver: dataSaver,
      source: 'mangadex_at_home'
    };
  }

// Instance singleton exportée
}

export const mangadexAdapter = new MangaDexAdapter();
