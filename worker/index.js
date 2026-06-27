// Cloudflare Worker - Card OG 서버
// 환경변수 설정 필요: SUPABASE_URL, SUPABASE_ANON_KEY

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // /card/:id 라우트만 처리
    const match = pathname.match(/^\/card\/([a-zA-Z0-9-]+)$/)
    if (!match) {
      return new Response('Not Found', { status: 404 })
    }

    const cardId = match[1]

    // Supabase에서 카드 조회
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/card?id=eq.${cardId}&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        },
      }
    )

    const cards = await res.json()

    if (!cards.length) {
      return new Response('Card Not Found', { status: 404 })
    }

    const card = cards[0]
    const userAgent = request.headers.get('User-Agent') || ''

    // 크롤러 감지 (Twitter, Telegram, Discord 등)
    const isCrawler = /twitterbot|facebookexternalhit|telegrambot|discordbot|linkedinbot|slackbot|whatsapp/i.test(userAgent)

    if (isCrawler) {
      // 크롤러한테는 OG 메타태그 박힌 HTML 반환
      const html = buildOgHtml(card)
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      })
    }

    // 일반 사용자는 Bluesky로 리다이렉트
    return Response.redirect(card.bsky_url, 302)
  },
}

function buildOgHtml(card) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${card.bsky_url}" />
  <meta property="og:image" content="${card.img_url}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${card.img_url}" />
  <meta http-equiv="refresh" content="0;url=${card.bsky_url}" />
</head>
<body>
  <p>Redirecting to <a href="${card.bsky_url}">${card.bsky_url}</a></p>
</body>
</html>`
}
