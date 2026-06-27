# 세팅 가이드

## 1. Supabase

### 테이블 생성
Supabase > SQL Editor에서 실행:

```sql
-- 테이블은 이미 생성됨. RLS 정책만 추가:
alter table card enable row level security;

create policy "public read" on card
  for select using (true);

create policy "anon insert" on card
  for insert with check (true);

create policy "anon delete" on card
  for delete using (true);
```

### Storage 버킷 생성
Supabase > Storage > New Bucket
- Name: `card-images`
- Public: ✅ 체크

### 환경변수
`config.js`에 입력:
- `SUPABASE_URL`: Project Settings > API > Project URL
- `SUPABASE_ANON_KEY`: Project Settings > API > anon public

---

## 2. Cloudflare Worker

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler deploy

# 환경변수 설정
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
```

배포 후 나오는 Worker URL을 `config.js`의 `WORKER_URL`에 입력.

---

## 3. GitHub Pages

Repository Settings > Pages > Source: `Deploy from a branch` > `main` / `/ (root)`

그러면 `https://tensorgitdev.github.io/card-generator/`로 어드민 접속 가능.
