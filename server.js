import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const MD = "https://api.mangadex.org";

app.get("/api/health", (req, res) => {
  res.json({ ok: true, version: "0.8.0", service: "Otaku-World Backend" });
});

// Proxy recherche MangaDex
app.get("/api/mangadex/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ data: [] });
    const url = new URL(MD + "/manga");
    url.searchParams.set("limit", "18");
    url.searchParams.set("title", q);
    url.searchParams.append("contentRating[]", "safe");
    url.searchParams.append("contentRating[]", "suggestive");
    url.searchParams.append("includes[]", "cover_art");
    const r = await fetch(url, { headers: { "User-Agent": "Otaku-World/0.8 (https://github.com/archange22/Otaku-world-)" } });
    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (e) {
    res.status(502).json({ error: "MangaDex indisponible" });
  }
});

// Proxy fiche manga MangaDex
app.get("/api/mangadex/manga/:id", async (req, res) => {
  try {
    const url = new URL(MD + "/manga/" + encodeURIComponent(req.params.id));
    url.searchParams.append("includes[]", "cover_art");
    url.searchParams.append("includes[]", "author");
    url.searchParams.append("includes[]", "artist");
    const r = await fetch(url, { headers: { "User-Agent": "Otaku-World/0.8" } });
    res.status(r.status).type("application/json").send(await r.text());
  } catch (e) {
    res.status(502).json({ error: "MangaDex indisponible" });
  }
});

// Proxy chapitres MangaDex
app.get("/api/mangadex/manga/:id/feed", async (req, res) => {
  try {
    const url = new URL(MD + "/manga/" + encodeURIComponent(req.params.id) + "/feed");
    url.searchParams.set("limit", "100");
    url.searchParams.append("translatedLanguage[]", "fr");
    url.searchParams.append("contentRating[]", "safe");
    url.searchParams.append("contentRating[]", "suggestive");
    url.searchParams.set("order[chapter]", "desc");
    const r = await fetch(url, { headers: { "User-Agent": "Otaku-World/0.8" } });
    res.status(r.status).type("application/json").send(await r.text());
  } catch (e) {
    res.status(502).json({ error: "Chapitres MangaDex indisponibles" });
  }
});

app.listen(PORT, () => {
  console.log(`[Otaku-World v0.8] Backend actif sur le port ${PORT}`);
});
