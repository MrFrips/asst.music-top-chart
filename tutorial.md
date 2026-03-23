# Deployment Guide

Step-by-step deployment guide menggunakan **Vercel** + **GitHub Actions**.

---

## Prerequisites

Sebelum deploy, pastikan Anda sudah memiliki:

- [ ] **Repository GitHub** — project sudah di-push ke GitHub
- [ ] **Spotify API credentials** — buat app di [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), catat `Client ID` dan `Client Secret`
- [ ] **Database** — MySQL atau PostgreSQL (lihat Step 1)

---

## Step 1: Siapkan Database

Project ini mendukung **MySQL** dan **PostgreSQL**. Pilih salah satu.

### Pilih Prisma Schema

Sebelum deploy, pastikan `prisma/schema.prisma` sesuai dengan database Anda:

```bash
# Jika pakai MySQL:
cp prisma/schema.mysql.prisma prisma/schema.prisma

# Jika pakai PostgreSQL:
cp prisma/schema.postgresql.prisma prisma/schema.prisma
```

Commit perubahan ini:
```bash
git add prisma/schema.prisma
git commit -m "use mysql/postgresql schema"
git push
```

### Provider Database (Pilih Salah Satu)

| Provider | Tipe | Biaya | Connection String |
|----------|------|-------|-------------------|
| [Hostinger](https://www.hostinger.com) | MySQL | Termasuk hosting | `mysql://user:pass@host:3306/db` |
| [Neon](https://neon.tech) | PostgreSQL | Gratis | `postgresql://user:pass@host/db?sslmode=require` |
| [Supabase](https://supabase.com) | PostgreSQL | Gratis | `postgresql://postgres:pass@host:5432/postgres` |
| [PlanetScale](https://planetscale.com) | MySQL | Gratis | `mysql://user:pass@host/db?ssl=...` |
| [Railway](https://railway.app) | Keduanya | ~$5/bulan | Lihat dashboard Railway |

> **Hostinger MySQL:** Jangan lupa aktifkan **Remote MySQL** di hPanel → Databases → Remote MySQL → tambahkan `%` agar bisa diakses dari Vercel & GitHub Actions.

Setelah punya connection string, push schema:

```bash
# Set DATABASE_URL di .env lokal
npx prisma db push
```

---

## Step 2: Deploy ke Vercel

### 2.1 Import Project

1. Buka [vercel.com/new](https://vercel.com/new) (login dengan GitHub)
2. Cari dan pilih repo `mewwme-top-chart`
3. Klik **"Import"**

### 2.2 Set Environment Variables

Di halaman **"Configure Project"**, klik **"Environment Variables"** dan tambahkan:

| NAME | VALUE |
|------|-------|
| `DATABASE_URL` | Connection string database Anda |
| `SPOTIFY_CLIENT_ID` | Client ID dari Spotify Developer |
| `SPOTIFY_CLIENT_SECRET` | Client Secret dari Spotify Developer |
| `ADMIN_SECRET` | Secret bebas untuk trigger refresh (contoh: `mewwme`) |
| `SCRAPE_COUNTRIES` | `global,id,us,gb,jp,de,fr,br,mx,kr,in,au,es,it,ca,se,ph,tr,ar,nl` |
| `TOP_ARTISTS_LIMIT` | `25` |
| `TOP_TRACKS_LIMIT` | `25` |

**Opsional** (rotasi rate limit Spotify):

| NAME | VALUE |
|------|-------|
| `SPOTIFY_CLIENT_ID_2` | Client ID ke-2 |
| `SPOTIFY_CLIENT_SECRET_2` | Client Secret ke-2 |
| `SPOTIFY_CLIENT_ID_3` | Client ID ke-3 |
| `SPOTIFY_CLIENT_SECRET_3` | Client Secret ke-3 |

### 2.3 Deploy

1. Klik **"Deploy"**
2. Tunggu build selesai (~1-2 menit)
3. Catat URL yang diberikan (contoh: `https://mewwme-top-chart.vercel.app`)
4. Buka URL → Anda akan melihat **API Explorer**

> Data masih kosong. Lanjut ke Step 3 untuk setup auto-refresh.

---

## Step 3: Setup GitHub Actions (Auto Refresh)

Vercel punya batas waktu 10-30 detik per function, sedangkan proses scraping bisa **10-30 menit**. Solusinya: **GitHub Actions menjalankan scraping langsung di server GitHub** (batas waktu 6 jam).

### Cara Kerja

```
GitHub Actions (setiap 12 jam)
  ├── Build Next.js di server GitHub
  ├── Start server di localhost
  ├── Jalankan scraping (Kworb → Spotify → Last.fm → Wikipedia)
  ├── Simpan data ke database
  └── Selesai. Vercel tinggal baca data dari DB.
```

### 3.1 Tambahkan Secrets di GitHub

1. Buka repo di GitHub
2. Klik **Settings** → **Secrets and variables** → **Actions**
3. Klik **"New repository secret"** untuk setiap variable:

| Secret Name | Value |
|-------------|-------|
| `DATABASE_URL` | Sama dengan di Vercel |
| `SPOTIFY_CLIENT_ID` | Sama dengan di Vercel |
| `SPOTIFY_CLIENT_SECRET` | Sama dengan di Vercel |
| `ADMIN_SECRET` | Sama dengan di Vercel |
| `SCRAPE_COUNTRIES` | Sama dengan di Vercel |
| `TOP_ARTISTS_LIMIT` | `25` |
| `TOP_TRACKS_LIMIT` | `25` |

Opsional (jika punya Spotify app tambahan):

| Secret Name | Value |
|-------------|-------|
| `SPOTIFY_CLIENT_ID_2` | Client ID ke-2 |
| `SPOTIFY_CLIENT_SECRET_2` | Client Secret ke-2 |

### 3.2 Pastikan File Workflow Ada

File `.github/workflows/refresh-cron.yml` sudah ada di project. Workflow ini:
- Berjalan otomatis setiap hari jam **06:00** dan **18:00 UTC** (13:00 dan 01:00 WIB)
- Bisa di-trigger manual dari tab Actions

### 3.3 Hapus Vercel Cron

Karena scraping sekarang dilakukan oleh GitHub Actions, edit `vercel.json` menjadi:

```json
{}
```

Commit & push:
```bash
git add vercel.json
git commit -m "remove vercel cron"
git push
```

---

## Step 4: Jalankan Refresh Pertama

1. Buka repo di GitHub → tab **Actions**
2. Klik **"Daily Stats Refresh"** di sidebar
3. Klik **"Run workflow"** → pilih branch `main` → **"Run workflow"**
4. Tunggu selesai (10-30 menit, tergantung jumlah negara)
5. Status berubah ✅ hijau = data sudah masuk ke database

---

## Step 5: Verifikasi

Buka URL Vercel Anda dan test endpoint ini:

| Endpoint | Hasil |
|----------|-------|
| `/api/stats/countries` | Daftar negara |
| `/api/stats/artists?country=global` | 25 artis teratas |
| `/api/stats/tracks?country=global` | 25 lagu teratas |
| `/api/stats/last-updated` | Timestamp refresh terakhir |

Jika data muncul, deployment berhasil! 🎉

Data akan di-refresh otomatis 2x sehari oleh GitHub Actions.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| GitHub Actions gagal di step "Build" | Cek apakah semua secrets sudah ditambahkan |
| Database connection error | Pastikan remote access diizinkan (Hostinger: Remote MySQL → `%`) |
| Data kosong setelah refresh | Cek log GitHub Actions untuk error detail |
| Spotify 429 (rate limit) | Tambah Spotify credentials ke-2 dan ke-3 |
| GitHub Actions timeout | Kurangi `SCRAPE_COUNTRIES` (contoh: `global,id,us`) |

---

## Ubah Jadwal Cron

Edit `.github/workflows/refresh-cron.yml`:

```yaml
on:
  schedule:
    - cron: '0 6,18 * * *'  # Default: 2x sehari
```

| Jadwal | Cron |
|--------|------|
| Sekali sehari | `'0 0 * * *'` |
| Setiap 6 jam | `'0 */6 * * *'` |
| 3x sehari | `'0 0,8,16 * * *'` |
