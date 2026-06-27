// 비밀번호 체크
;(function () {
  const PASS = '0000'
  if (sessionStorage.getItem('authed') === PASS) return

  // 오버레이로 내용 가리기
  const overlay = document.createElement('div')
  overlay.id = 'login-overlay'
  overlay.innerHTML = `
    <div id="login-box">
      <h2>관리자</h2>
      <input type="password" id="login-input" placeholder="비밀번호" />
      <p id="login-error"></p>
      <button id="login-btn">확인</button>
    </div>
  `
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: '#f5f5f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '9999'
  })
  document.body.style.visibility = 'hidden'
  document.body.appendChild(overlay)
  overlay.style.visibility = 'visible'

  const style = document.createElement('style')
  style.textContent = `
    #login-box { background:#fff; padding:2rem; border-radius:10px;
      box-shadow:0 4px 16px rgba(0,0,0,.12); display:flex; flex-direction:column; gap:.8rem; min-width:260px; }
    #login-box h2 { margin:0; font-size:1.2rem; }
    #login-input { padding:.6rem; border:1px solid #ccc; border-radius:6px; font-size:1rem; }
    #login-btn { padding:.6rem; background:#222; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:1rem; }
    #login-error { color:red; font-size:.85rem; margin:0; min-height:1rem; }
  `
  document.head.appendChild(style)

  function tryLogin() {
    const val = document.getElementById('login-input').value
    if (val === PASS) {
      sessionStorage.setItem('authed', PASS)
      overlay.remove()
      document.body.style.visibility = 'visible'
    } else {
      document.getElementById('login-error').textContent = '비밀번호가 틀렸습니다.'
      document.getElementById('login-input').value = ''
      document.getElementById('login-input').focus()
    }
  }

  document.getElementById('login-btn').addEventListener('click', tryLogin)
  document.getElementById('login-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryLogin()
  })
  document.getElementById('login-input').focus()
})()

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const BUCKET = 'card-img'

// 이미지 미리보기
$('#imageInput').on('change', function () {
  const file = this.files[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  $('#preview').html(`<img src="${url}" />`)
})

// 카드 생성
$('#submitBtn').on('click', async function () {
  const file = $('#imageInput')[0].files[0]
  const bskyUrl = $('#bskyUrl').val().trim()

  if (!file) return setStatus('이미지를 선택해주세요.', 'error')
  if (!bskyUrl) return setStatus('Bluesky URL을 입력해주세요.', 'error')

  $(this).prop('disabled', true)
  setStatus('업로드 중...')

  try {
    // 1. Supabase Storage에 이미지 업로드
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}.${ext}`
    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(fileName)

    // 2. DB에 카드 메타데이터 저장
    const { data, error: insertError } = await sb
      .from('card')
      .insert({ img_url: publicUrl, bsky_url: bskyUrl })
      .select()
      .single()

    if (insertError) throw insertError

    setStatus('카드 생성 완료!', 'success')
    $('#imageInput').val('')
    $('#bskyUrl').val('')
    $('#preview').empty()
    loadCards()
  } catch (err) {
    console.error(err)
    setStatus('오류: ' + err.message, 'error')
  } finally {
    $('#submitBtn').prop('disabled', false)
  }
})

// 카드 목록 로드
async function loadCards () {
  const { data, error } = await sb
    .from('card')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    $('#cardList').html('<p class="empty-msg">불러오기 실패</p>')
    return
  }

  if (!data.length) {
    $('#cardList').html('<p class="empty-msg">카드가 없습니다.</p>')
    return
  }

  const html = data.map(card => {
    const workerUrl = `${WORKER_URL}/card/${card.id}`
    return `
      <div class="card-item" data-id="${card.id}">
        <img src="${card.img_url}" alt="card" />
        <div class="card-meta">
          <span class="card-url" title="${workerUrl}">${workerUrl}</span>
          <button class="copy-btn" data-url="${workerUrl}">복사</button>
          <button class="delete-btn" data-id="${card.id}" data-img="${card.img_url}">삭제</button>
        </div>
      </div>
    `
  }).join('')

  $('#cardList').html(html)
}

// URL 복사
$(document).on('click', '.copy-btn', function () {
  const url = $(this).data('url')
  navigator.clipboard.writeText(url).then(() => {
    const $btn = $(this)
    $btn.text('복사됨!')
    setTimeout(() => $btn.text('복사'), 1500)
  })
})

// 카드 삭제
$(document).on('click', '.delete-btn', async function () {
  if (!confirm('삭제할까요?')) return
  const id = $(this).data('id')
  const imgUrl = $(this).data('img')

  // Storage에서 파일명 추출 후 삭제
  const fileName = imgUrl.split('/').pop()
  await sb.storage.from(BUCKET).remove([fileName])
  await sb.from('card').delete().eq('id', id)

  loadCards()
})

function setStatus (msg, type = '') {
  $('#statusMsg').text(msg).attr('class', 'status ' + type)
}

// 초기 로드
loadCards()
