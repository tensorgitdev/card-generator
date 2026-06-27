// Cloudflare Worker - Card OG 서버
const SUPABASE_URL = 'https://mqruxlhrxniyzbhkhmtc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcnV4bGhyeG5peXpiaGtobXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjgzMDIsImV4cCI6MjA4MzkwNDMwMn0.qPt-dN4Uj0d0pKU11AYy782XMuoXeJ7CFiVXmEyrJzA'

const ADMIN_USER = 'admin'
const ADMIN_PASS = '0000'

function basicAuth(request) {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Basic ')) return false
  const [user, pass] = atob(auth.slice(6)).split(':')
  return user === ADMIN_USER && pass === ADMIN_PASS
}

const authFail = () => new Response('Unauthorized', {
  status: 401,
  headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
})

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // /card/:id 라우트 처리
    const match = pathname.match(/^\/card\/([a-zA-Z0-9-]+)$/)
    if (!match) {
      // 관리자 페이지는 Basic Auth
      if (!basicAuth(request)) return authFail()
      return env.ASSETS.fetch(request)
    }

    const cardId = match[1]

    // Supabase에서 카드 조회
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/card?id=eq.${cardId}&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
  <meta property="og:title" content="Click to view on Bluesky" />
  <meta property="og:description" content="${card.bsky_url}" />
  <meta property="og:image" content="${card.img_url}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Click to view on Bluesky" />
  <meta name="twitter:description" content="${card.bsky_url}" />
  <meta name="twitter:image" content="${card.img_url}" />
  <meta http-equiv="refresh" content="0;url=${card.bsky_url}" />
</head>
<body>
  <p>Redirecting to <a href="${card.bsky_url}">${card.bsky_url}</a></p>
</body>
</html>`
}
