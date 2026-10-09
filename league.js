// GET /api/league?league=140&season=2025
// API-Football "standings" verisini tek istekle çeker: her takımın ev/deplasman
// gol istatistikleri ve son 5 maç formu gelir. API anahtarı yalnızca burada kalır.

const IZINLI_LIGLER = [39, 140, 135, 78, 61, 203]; // PL, La Liga, Serie A, Bundesliga, Ligue 1, Süper Lig

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return json(500, { error: "Sunucuda API_FOOTBALL_KEY tanımlı değil." });

  const q = event.queryStringParameters || {};
  const league = parseInt(q.league, 10);
  const season = parseInt(q.season, 10);
  if (!IZINLI_LIGLER.includes(league) || !(season >= 2015 && season <= 2100)) {
    return json(400, { error: "Geçersiz lig veya sezon." });
  }

  let d;
  try {
    const r = await fetch(
      `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`,
      { headers: { "x-apisports-key": key } }
    );
    if (!r.ok) return json(502, { error: `API-Football hata döndürdü (${r.status}).` });
    d = await r.json();
  } catch (e) {
    return json(502, { error: "API-Football'a ulaşılamadı." });
  }

  // errors alanı boşken [] ya da {} gelebilir
  const hatalar = Array.isArray(d.errors) ? d.errors : Object.values(d.errors || {});
  if (hatalar.length) {
    return json(502, { error: "API-Football: " + hatalar.join(" ") + " Başka bir sezon deneyin." });
  }

  const tablo = d.response && d.response[0] && d.response[0].league.standings[0];
  if (!tablo || !tablo.length) {
    return json(404, { error: "Bu lig ve sezon için veri bulunamadı. Başka bir sezon deneyin." });
  }

  const takimlar = tablo.map((t) => ({
    id: t.team.id,
    ad: t.team.name,
    form: t.form || "",
    evOyn: t.home.played, evAtilan: t.home.goals.for, evYenilen: t.home.goals.against,
    depOyn: t.away.played, depAtilan: t.away.goals.for, depYenilen: t.away.goals.against,
  }));

  return json(
    200,
    { lig: d.response[0].league.name, sezon: season, takimlar },
    {
      // Günlük 100 istek limitini korumak için sonuç 6 saat CDN'de saklanır
      "Cache-Control": "public, max-age=900",
      "Netlify-CDN-Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    }
  );
};
