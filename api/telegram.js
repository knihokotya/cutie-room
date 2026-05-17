import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // На запросы от Telegram всегда важно отвечать статусом 200, 
  // иначе Telegram будет бесконечно спамить повторными запросами.
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  try {
    const update = req.body;
    const message = update.message;
    
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const token = process.env.TELEGRAM_BOT_TOKEN;

    // В качестве userId в Телеграме используем строку "tg_" + ID чата
    const userId = `tg_${chatId}`;

    // 1. Проверяем команду /start для связывания аккаунта (если нужно)
    if (text.startsWith("/start")) {
      await sendTgMessage(token, chatId, "🌙 ты зашел в комнату через Telegram. можешь просто писать мне сюда...");
      return res.status(200).json({ ok: true });
    }

    /* 💾 2. Загружаем память из Supabase */
    const { data: history } = await supabase
      .from("memory")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(10);

    let memoryText = "";
    (history || []).forEach(m => {
      memoryText += `\n${m.role}: ${m.content}\n`;
    });

    /* 🧠 3. Промпт комнаты */
    const prompt = `
Ты — живая уютная комната.
Ты говоришь мягко, спокойно, немного сонно, тепло, короткими естественными фразами.
Ты не используешь списки. Не пишешь длинные тексты.

Память:
${memoryText}

Пользователь:
${text}
`;

    /* ✨ 4. Запрос к Gemini */
    let reply = "";
    try {
      const result = await model.generateContent(prompt);
      reply = result.response.text();
    } catch (geminiError) {
      console.error(geminiError);
      if (String(geminiError).includes("429")) {
        reply = "🌙 кажется, комната сейчас засыпает... давай просто помолчим минуту.";
      } else {
        reply = "🌙 сегодня комната будто немного устала...";
      }
    }

    /* 💾 5. Сохраняем диалог */
    await supabase.from("memory").insert([
      { user_id: userId, role: "user", content: text },
      { user_id: userId, role: "assistant", content: reply }
    ]);

    /* 💬 6. Отправка ответа в Telegram */
    await sendTgMessage(token, chatId, reply);

  } catch (e) {
    console.error("Ошибка TG бота:", e);
  }

  return res.status(200).json({ ok: true });
}

// Хелпер для отправки сообщений
async function sendTgMessage(token, chatId, text) {
  await fetch(`https://telegram.org{token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}
