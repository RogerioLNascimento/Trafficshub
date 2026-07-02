export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${process.env.NEXTAUTH_URL}/?google=error`);
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/google/callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return Response.redirect(`${process.env.NEXTAUTH_URL}/?google=error`);
    }

    const encoded = Buffer.from(JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: Date.now() + tokens.expires_in * 1000,
    })).toString("base64");

    return Response.redirect(`${process.env.NEXTAUTH_URL}/?google=success&tokens=${encoded}`);
  } catch (err) {
    return Response.redirect(`${process.env.NEXTAUTH_URL}/?google=error`);
  }
}
