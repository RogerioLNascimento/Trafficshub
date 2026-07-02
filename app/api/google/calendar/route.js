async function refreshAccessToken(refreshToken) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  return response.json();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tokensRaw = searchParams.get("tokens");

  if (!tokensRaw) {
    return Response.json({ error: "Token não fornecido." }, { status: 401 });
  }

  try {
    let tokens = JSON.parse(Buffer.from(tokensRaw, "base64").toString());

    if (Date.now() >= tokens.expiry - 60000 && tokens.refresh_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      if (refreshed.access_token) {
        tokens.access_token = refreshed.access_token;
        tokens.expiry = Date.now() + refreshed.expires_in * 1000;
      }
    }

    const now = new Date().toISOString();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const calendarRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&orderBy=startTime&singleEvents=true&maxResults=20`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    const data = await calendarRes.json();

    if (!calendarRes.ok) {
      return Response.json({ error: data.error?.message || "Erro ao buscar eventos." }, { status: calendarRes.status });
    }

    const events = (data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || "(sem título)",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      description: e.description || "",
      link: e.htmlLink,
    }));

    return Response.json({ events });
  } catch (err) {
    return Response.json({ error: "Erro ao processar tokens: " + err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { tokens: tokensRaw, event } = await request.json();

    if (!tokensRaw || !event) {
      return Response.json({ error: "Dados insuficientes." }, { status: 400 });
    }

    let tokens = JSON.parse(Buffer.from(tokensRaw, "base64").toString());

    if (Date.now() >= tokens.expiry - 60000 && tokens.refresh_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      if (refreshed.access_token) {
        tokens.access_token = refreshed.access_token;
        tokens.expiry = Date.now() + refreshed.expires_in * 1000;
      }
    }

    const calendarEvent = {
      summary: event.title,
      description: event.description || "",
      start: { dateTime: event.start, timeZone: "America/Sao_Paulo" },
      end: { dateTime: event.end, timeZone: "America/Sao_Paulo" },
    };

    const createRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    const created = await createRes.json();

    if (!createRes.ok) {
      return Response.json({ error: created.error?.message || "Erro ao criar evento." }, { status: createRes.status });
    }

    return Response.json({
      event: {
        id: created.id,
        title: created.summary,
        start: created.start?.dateTime,
        end: created.end?.dateTime,
        link: created.htmlLink,
      },
    });
  } catch (err) {
    return Response.json({ error: "Erro inesperado: " + err.message }, { status: 500 });
  }
}
