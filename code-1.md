# 🤖 Telegram AI Bot + Dashboard Statistik

## Ringkasan Project
Bot Telegram yang terhubung ke AI (OpenRouter API), hosting gratis di Vercel,
dengan dashboard web untuk memantau jumlah penggunaan. Bot memiliki memory
percakapan (AI ingat konteks chat) menggunakan Supabase PostgreSQL.

## Tech Stack
- **Runtime:** Vercel Serverless Functions (Node.js >= 18)
- **AI API:** OpenRouter (model gratis: `meta-llama/llama-3.1-8b-instruct:free`)
- **Database:** Supabase PostgreSQL untuk statistik & riwayat chat
- **Frontend:** HTML statis untuk dashboard

## Struktur Project
```
telegram-ai-bot/
├── api/
│   ├── bot.js      # Webhook Telegram + logika AI + memory (Supabase PG)
│   └── stats.js    # API statistik untuk dashboard (Supabase PG)
├── public/
│   └── index.html  # Dashboard penggunaan
├── init-supabase-db.sql
├── package.json
├── vercel.json
├── .env.example
└── README.id.md
```

## Prasyarat (dibuat manual oleh user)
1. Token bot Telegram: chat dengan @BotFather → `/newbot` → simpan token
2. API key OpenRouter: daftar di https://openrouter.ai → buat API key
3. Akun Vercel (gratis): https://vercel.com
4. Database Supabase PostgreSQL: https://supabase.com → buat project → dapatkan connection string
5. Node.js terinstall di lokal (>= 18)

---

## FILE 1: `package.json`

```json
{
  "name": "telegram-ai-bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@vercel/kv": "^1.0.1",
    "pg": "^8.11.0"
  }
}
```

## FILE 2: `vercel.json`

```json
{
  "functions": {
    "api/bot.js": {
      "maxDuration": 30
    }
  }
}
```

## FILE 3: `api/bot.js`

```js
const TELEGRAM_MESSAGE_LIMIT = 4000;
const OPENROUTER_TIMEOUT_MS = 25_000;
const FALLBACK_REPLY = 'Maaf, AI sedang bermasalah atau terlalu lama merespons. Coba lagi ya!';

function splitMessage(text, maxLength = TELEGRAM_MESSAGE_LIMIT) {
  const characters = Array.from(String(text));
  const chunks = [];

  for (let start = 0; start < characters.length; start += maxLength) {
    chunks.push(characters.slice(start, start + maxLength).join(''));
  }

  return chunks.length ? chunks : [''];
}

export default async function handler(req, res) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'rahasia-ku-12345-abc';

  if (req.query?.secret !== WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  if (req.method !== 'POST') return res.status(200).send('OK');

  const message = req.body?.message;
  if (!message?.text) return res.status(200).send('OK');

  const chatId = message.chat?.id;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!chatId || !TELEGRAM_TOKEN || !OPENROUTER_API_KEY) {
    console.error('Missing chat ID or required environment variable.');
    return res.status(200).send('OK');
  }

  const sendTelegramMessage = async (text) => {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) throw new Error(`Telegram API returned ${response.status}`);
  };

  const sendReply = async (text) => {
    for (const chunk of splitMessage(text)) await sendTelegramMessage(chunk);
  };

  let db;
  try {
    const { Client } = await import('pg');
    const connectionString = process.env.SUPABASE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('SUPABASE_CONNECTION_STRING environment variable is not set');
    }
    db = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await db.connect();
  } catch (error) {
    console.error('Unable to connect to Supabase:', error);
    try {
      await sendReply(FALLBACK_REPLY);
    } catch (telegramError) {
      console.error('Unable to send fallback reply:', telegramError);
    }
    return res.status(200).send('OK');
  }

  const historyKey = `history:${chatId}`;

  if (message.text === '/reset') {
    try {
      await db.query('DELETE FROM chat_history WHERE chat_id = $1', [chatId]);
      await sendTelegramMessage('🧹 Memori berhasil direset! Mulai percakapan baru ya.');
    } catch (error) {
      console.error('Reset command failed:', error);
      try {
        await sendTelegramMessage('Maaf, memori belum bisa direset. Coba lagi ya!');
      } catch (telegramError) {
        console.error('Unable to send reset error message:', telegramError);
      }
    }

    return res.status(200).send('OK');
  }

  try {
    await db.query('INSERT INTO stats DEFAULT VALUES');
    if (message.from?.id) await db.query('INSERT INTO user_activity(user_id) VALUES($1)', [message.from.id]);
  } catch (error) {
    console.error('Unable to update usage statistics:', error);
  }

  let history = [];
  try {
    const result = await db.query('SELECT * FROM chat_history WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT 20', [chatId]);
    history = result.rows.reverse();
  } catch (error) {
    console.error('Unable to load chat history:', error);
  }

  history = [...history, { role: 'user', content: message.text }].slice(-20);

  let reply = FALLBACK_REPLY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'Kamu asisten AI yang ramah dan membantu. Balas dalam Bahasa Indonesia yang santai.',
          },
          ...history,
        ],
      }),
      signal: controller.signal,
    });

    if (!aiResponse.ok) throw new Error(`OpenRouter returned ${aiResponse.status}`);

    const data = await aiResponse.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenRouter response has no message content.');
    reply = content;
  } catch (error) {
    console.error('OpenRouter request failed:', error);
  } finally {
    clearTimeout(timeout);
  }

  try {
    await db.query('INSERT INTO chat_history (chat_id, message) VALUES ($1, $2)', [chatId, JSON.stringify({ role: 'assistant', content: reply })]);
  } catch (error) {
    console.error('Unable to save chat history:', error);
  }

  try {
    await sendReply(reply);
  } catch (error) {
    console.error('Unable to send Telegram reply:', error);
  }

  return res.status(200).send('OK');
}

export { splitMessage };
```

## FILE 4: `api/stats.js`

```js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.SUPABASE_CONNECTION_STRING,
      ssl: { rejectUnauthorized: false }
    });
    const result = await pool.query('SELECT COUNT(*) as total FROM stats');
    const total = parseInt(result.rows[0]?.total) || 0;
    await pool.end();
    return res.status(200).json({ total });
  } catch (error) {
    console.error('Stats handler failed:', error);
    return res.status(503).json({ total: 0 });
  }
}
```

## FILE 5: `public/index.html`

```html
<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard Bot AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
    }
    .card {
      width: min(100%, 420px);
      padding: 40px;
      text-align: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }
    h1 { margin-bottom: 24px; color: #c4c4c8; font-size: 20px; }
    .number { color: #4ade80; font-size: clamp(52px, 14vw, 64px); font-weight: 700; }
    .label { margin-top: 8px; color: #9696a1; }
    .error { margin-top: 16px; color: #fca5a5; font-size: 14px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>📊 Statistik Bot AI Telegram</h1>
    <div id="total" class="number" aria-live="polite">...</div>
    <div class="label">Total Pesan Diproses</div>
    <p id="error" class="error" hidden>Statistik belum dapat dimuat. Coba refresh halaman.</p>
  </main>

  <script>
    fetch('/api/stats')
      .then((response) => {
        if (!response.ok) throw new Error('Stats request failed');
        return response.json();
      })
      .then(({ total }) => {
        document.getElementById('total').textContent = total;
      })
      .catch(() => {
        document.getElementById('error').hidden = false;
      });
  </script>
</body>
</html>
```

---

## Langkah Deploy (jalankan berurutan)

### 1. Setup Database Supabase
- Buka https://supabase.com dan buat akun
- Buat project database baru
- Dapatkan connection string (PostgreSQL)
- Jalankan `init-supabase-db.sql` di Supabase dashboard atau via psql

### 2. Install dependencies
```bash
npm install
```

### 3. Login Vercel
```bash
npx vercel login
```

### 4. Deploy project
```bash
npx vercel
```
Saat ditanya pertanyaan setup, jawab default saja. Catat URL hasil deploy
(contoh: `https://telegram-ai-bot-xxx.vercel.app`).

### 5. Set Environment Variables
```bash
npx vercel env add TELEGRAM_TOKEN
npx vercel env add OPENROUTER_API_KEY
npx vercel env add WEBHOOK_SECRET
npx vercel env add SUPABASE_CONNECTION_STRING
```
Lalu redeploy:
```bash
npx vercel --prod
```

### 6. Set Webhook Telegram
Ganti `<TELEGRAM_TOKEN>` dan `<VERCEL_URL>` sesuai punyamu:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<VERCEL_URL>/api/bot?secret=rahasia-ku-12345-abc"
```
Respons sukses: `{"ok":true,"result":true,"description":"Webhook was set"}`

### 7. Cek webhook aktif (opsional)
```bash
curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/getWebhookInfo"
```

### 8. Testing
- Buka bot di Telegram, kirim: "Halo" → harus dibalas AI
- Kirim beberapa pesan lanjutan → AI harus ingat konteks
- Kirim `/reset` → memori terhapus
- Buka `https://<VERCEL_URL>` → dashboard menampilkan total penggunaan

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Bot tidak membalas | Cek `getWebhookInfo`, pastikan URL benar & secret cocok |
| Error 500 di logs | Cek environment variables sudah diset + sudah redeploy |
| DB connect error | Pastikan `SUPABASE_CONNECTION_STRING` benar dan database sudah di-setup |
| AI balas error | Rate limit model `:free`, tunggu sebentar atau ganti model |
| Memori tidak jalan | Pastikan database Supabase terhubung |

## Catatan Penting
- Model `:free` OpenRouter punya rate limit (~20 req/menit)
- Riwayat chat dibatasi 20 pesan terakhir per chat
- Riwayat disimpan permanen sampai user kirim `/reset`
- Untuk cek log error: dashboard Vercel → project → tab **Logs**
- Gunakan `pg` package (bukan `postgres`) untuk koneksi database
