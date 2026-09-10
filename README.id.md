# 🤖 Bot AI Telegram + Dashboard Statistik

Bot Telegram yang terhubung ke AI (OpenRouter API) dengan memori percakapan per chat, penanganan error yang tangguh, limit pesan per chat, dan dashboard web untuk memantau statistik.

---

## ⚙️ Teknologi yang Digunakan

- **Runtime:** Vercel Serverless Functions (Node.js)
- **API AI:** OpenRouter (model gratis `meta-llama/llama-3.1-8b-instruct:free`)
- **Database:** Neon PostgreSQL untuk statistik & riwayat chat
- **Frontend:** HTML statis untuk dashboard

---

## 🛠️ Cara Penggunaan

### 1. Setup awal

#### 1.1 Dapatkan Token Bot Telegram
- Chat dengan `@BotFather` di Telegram
- Kirim `/newbot`
- Beri nama bot (contoh: "AI Chatbot") dan username (contoh: `AIBot123`)
- BotFather akan memberi **Token Bot**: `123456:ABC-DEF1234ghIkl-zyx57QW2v1u123ew11`

#### 1.2 Buat Akun OpenRouter
- Buka https://openrouter.ai
- Daftar & buat **API Key**
- Salin key (contoh: `sk-or-v1-...`)

#### 1.3 Buat Akun Vercel
- Buat project di https://vercel.com
- Hubungkan repository Git (atau upload manual)
- Pastikan Anda punya akun Vercel gratis

#### 1.4 Setup Lokal (opsional)
- `git clone <repo>`
- `cd telegram-ai-bot`
- `npm install` (hanya untuk cek, Vercel install otomatis)

### 2. Deploy di Vercel

#### 2.1 Klik "Deploy"
- Di Vercel dashboard → "New Project"
- Pilih repository atau upload zip folder
- Nama project: `telegram-ai-bot`
- Region: closest to you

#### 2.2 Environment Variables
Di Vercel dashboard → "Environment Variables" → Tambah:

| Nama            | Nilai (contoh)                |
|------------------|------------------------------|
| `TELEGRAM_TOKEN` | `123456:ABC-DEF1234ghIkl-zyx57QW2v1u123ew11` |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` |
| `WEBHOOK_SECRET` | `rahasia-ku-12345-abc` *(string acak, pakai ini juga di step 4)* |
| `NEON_CONNECTION_STRING` | `postgresql://...` *(koneksi database Neon)* |

Klik **Add** → **Deploy**

#### 2.3 Setup Database Neon
- Buka https://neon.com dan buat akun
- Buat project database baru
- Dapatkan connection string (PostgreSQL)
- Salin ke environment variable `NEON_CONNECTION_STRING`

#### 2.4 Redeploy
Setelah database terhubung, jalankan:
```bash
npx vercel --prod
```
(Vercel CLI atau klik "Deploy" di dashboard lagi)

### 3. Set Webhook Telegram

Ganti placeholder di bawah dengan value sebenarnya:

```bash
WEBHOOK_URL="https://telegram-ai-bot.vercel.app/api/bot"
TOKEN="$TELEGRAM_TOKEN"
SECRET="$WEBHOOK_SECRET"

curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook?url=$WEBHOOK_URL?secret=$SECRET"
```

**Response sukses:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

> ⚠️ **Catatan rahasia:** `WEBHOOK_SECRET` tidak pernah bocor ke log Telegram.
> Tetap rahasia URL lengkap ini (`$WEBHOOK_URL?secret=$SECRET`). Jika bocor, ganti `WEBHOOK_SECRET` + set ulang webhook.

### 4. Pengujian (manual)

#### 4.1 Chat dengan bot
- Buka Telegram → cari bot kamu (misal: `@AIBot123`)
- Kirim pesan: `Halo` → bot balas dalam Bahasa Indonesia

#### 4.2 Konteks percakapan
- Kirim: `Siapa nama kamu?` → bot jawab
- Lanjut: `Saya Agus.` → bot harus ingat "Agus"

#### 4.3 Reset memori
- Kirim: `/reset`
- Bot balas: `🧹 Memori berhasil direset! Mulai percakapan baru ya.`
- Coba lagi pertanyaan tadi → bot jawab *baru* (tanpa konteks sebelumnya)

#### 4.4 Dashboard
- Buka: `https://telegram-ai-bot.vercel.app`
- Halaman akan tampil otomatis total pesan yang diproses.
- Jika gagal load, periksa browser console → kemungkinan error environment variable atau database.

### 5. Penanganan Error Umum

| Gejala | Kemungkinan Penyebab | Solusi |
|---------|--------------|-----|
| Bot tidak membalas sama sekali | Webhook tidak pernah trigger (secret/token salah) | Cek `getWebhookInfo`; pastikan URL benar & secret cocok |
| Error 500 di dashboard Vercel | Environment variable hilang atau database tidak connect | Tambah `TELEGRAM_TOKEN`, `OPENROUTER_API_KEY`, `WEBHOOK_SECRET`, `NEON_CONNECTION_STRING`; redeploy |
| Bot balas "Maaf, AI sedang bermasalah..." | OpenRouter timeout/rate limit model `:free` | Tunggu sebentar atau ganti model di kode (file `api/bot.js`) |
| Memori tidak jalan (bot jawab acak) | Database PostgreSQL tidak connect | Pastikan database Neon terhubung di dashboard Vercel |

### 6. Kode Sumber & Customize

#### 6.1 Bot (`api/bot.js`)
- **Memory per chat:** tiap private chat/grup punya riwayat sendiri (`history:{chatId}`)
- **Limit riwayat:** maksimal 20 pesan terakhir per chat
- **Pesan panjang:** otomatis dipecah tiap 4000 karakter (bawah batas Telegram)
- **Timeout:** permintaan OpenRouter maksimal 25 detik, fallback dikirim ke user
- **Command:** `/reset` hapus riwayat saja, tidak dihitung sebagai penggunaan AI

#### 6.2 Statistik (`api/stats.js`)
- Endpoint publik, CORS diizinkan
- Hanya menampilkan `total_usage` (jumlah pesan yang diproses)
- Dikirim ke Neon PostgreSQL table `stats` column `total_usage` (increment tiap pesan)

#### 6.3 Dashboard (`public/index.html`)
- Responsif, design modern gelap
- Menampilkan angka total pesan
- Menunjukkan pesan error jika stats gagal load

### 7. Update Future

- Tambah command admin `/stats` (total keseluruhan)
- Export riwayat chat per user ke CSV
- Tambah interval otomatis reset (opsional)
- Integrasi model AI lain selain OpenRouter gratis

---

## 📋 Checklist sebelum deploy

- [ ] Token bot Telegram
- [ ] API Key OpenRouter
- [ ] Akun Vercel + project
- [ ] Database Neon buat & connection string
- [ ] `TELEGRAM_TOKEN`, `OPENROUTER_API_KEY`, `WEBHOOK_SECRET`, `NEON_CONNECTION_STRING` di environment Vercel
- [ ] Deploy → `npx vercel --prod`
- [ ] Set webhook dengan `?secret=`
- [ ] Test chat + reset + dashboard

Jika semua checklist hijau, bot siap menerima pesan!

---

**Di buat dengan ❤️ untuk Telegram community**

*Versi 2.0.0*# neon-updated