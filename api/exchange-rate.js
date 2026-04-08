const FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates?base=PKR&quotes=CAD";

function setCacheHeaders(res, forceRefresh) {
  if (forceRefresh) {
    res.setHeader("Cache-Control", "no-store");
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=43200, stale-while-revalidate=3600");
}

export default async function handler(req, res) {
  const forceRefresh = req.query.refresh === "1";

  try {
    const response = await fetch(FRANKFURTER_URL, {
      headers: {
        Accept: "application/json",
      },
      cache: forceRefresh ? "no-store" : "default",
    });

    if (!response.ok) {
      throw new Error(`Exchange provider responded with ${response.status}`);
    }

    const payload = await response.json();
    const latestQuote = Array.isArray(payload) ? payload[0] : null;
    const rate = Number(latestQuote?.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Exchange provider did not return a valid CAD rate.");
    }

    setCacheHeaders(res, forceRefresh);
    res.status(200).json({
      rate,
      fetchedAt: new Date().toISOString(),
      providerDate: latestQuote?.date || null,
      source: "Frankfurter",
      base: "PKR",
      quote: "CAD",
    });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({
      error: "Failed to fetch PKR to CAD exchange rate.",
      details: error.message,
    });
  }
}
