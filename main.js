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
      .insert({ image_url: publicUrl, bsky_url: bskyUrl })
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
        <img src="${card.image_url}" alt="card" />
        <div class="card-meta">
          <span class="card-url" title="${workerUrl}">${workerUrl}</span>
          <button class="copy-btn" data-url="${workerUrl}">복사</button>
          <button class="delete-btn" data-id="${card.id}" data-img="${card.image_url}">삭제</button>
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
