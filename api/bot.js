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
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret || req.query?.secret !== webhookSecret) {
    return res.status(401).send('Unauthorized');
  }

  if (req.method !== 'POST') return res.status(200).send('OK');

  const message = req.body?.message;
  if (!message?.text) return res.status(200).send('OK');

  const chatId = message.chat?.id;
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!chatId || !telegramToken || !openRouterApiKey) {
    console.error('Missing chat ID or required environment variable.');
    return res.status(200).send('OK');
  }

  const sendTelegramMessage = async (text) => {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) throw new Error(`Telegram API returned ${response.status}`);
  };

  const sendReply = async (text) => {
    for (const chunk of splitMessage(text)) await sendTelegramMessage(chunk);
  };

  let kv;
  try {
    ({ kv } = await import('@vercel/kv'));
  } catch (error) {
    console.error('Unable to load Vercel KV:', error);
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
      await kv.del(historyKey);
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
    await kv.incr('total_usage');
    if (message.from?.id) await kv.incr(`user:${message.from.id}`);
  } catch (error) {
    console.error('Unable to update usage statistics:', error);
  }

  let history = [];
  try {
    const storedHistory = await kv.get(historyKey);
    if (Array.isArray(storedHistory)) history = storedHistory;
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
        Authorization: `Bearer ${openRouterApiKey}`,
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
    await kv.set(historyKey, [...history, { role: 'assistant', content: reply }].slice(-20));
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