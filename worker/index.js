// Cloudflare Worker - Card OG 서버
const SUPABASE_URL = 'https://mqruxlhrxniyzbhkhmtc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcnV4bGhyeG5peXpiaGtobXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjgzMDIsImV4cCI6MjA4MzkwNDMwMn0.qPt-dN4Uj0d0pKU11AYy782XMuoXeJ7CFiVXmEyrJzA'

const ADMIN_PASS = '0000'
const COOKIE = 'admin_tok'

function isAuthed(request) {
  const cookie = request.headers.get('Cookie') || ''
  return cookie.split(';').some(c => c.trim() === `${COOKIE}=${ADMIN_PASS}`)
}

function loginPage(err = false) {
  return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Login</title>
<style>*{box-sizing:border-box}body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif}
.box{background:#fff;padding:2rem;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);display:flex;flex-direction:column;gap:.8rem;min-width:260px}
h2{margin:0;font-size:1.2rem}input{padding:.6rem;border:1px solid #ccc;border-radius:6px;font-size:1rem}
button{padding:.6rem;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:1rem}
.err{color:red;font-size:.85rem;margin:0}</style></head>
<body><div class="box"><h2>관리자</h2>
${err ? '<p class="err">비밀번호가 틀렸습니다.</p>' : ''}
<form method="POST" action="/__login">
<input type="password" name="pass" placeholder="비밀번호" autofocus />
<button type="submit">확인</button>
</form></div></body></html>`, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // 로그인 처리
    if (pathname === '/__login' && request.method === 'POST') {
      const form = await request.formData()
      if (form.get('pass') === ADMIN_PASS) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: '/',
            'Set-Cookie': `${COOKIE}=${ADMIN_PASS}; Path=/; HttpOnly; SameSite=Strict`
          }
        })
      }
      return loginPage(true)
    }

    // /card/:id 라우트 처리
    const match = pathname.match(/^\/card\/([a-zA-Z0-9-]+)$/)
    if (!match) {
      if (!isAuthed(request)) return loginPage()
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
