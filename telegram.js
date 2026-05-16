import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const BOT = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {

  const update = req.body;

  if (!update.message) return res.json({ ok: true });

  const chatId = update.message.chat.id;
  const text = update.message.text;

  if (text.startsWith("/start")) {

    const link = text.split(" ")[1]; // link_userId

    if (link) {
      const userId = link.replace("link_", "");

      await supabase.from("users").upsert({
        user_id: userId,
        telegram_chat_id: chatId,
        linked: true,
        last_seen: new Date().toISOString()
      });

      await send(chatId, "💗 Комната подключена. Я запомнила тебя.");
    }
  }

  res.json({ ok: true });
}

async function send(chatId, text){
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
}