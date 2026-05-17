import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Инициализация актуальной бесплатной модели
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// Подключение базы данных
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // Принимаем только POST-запросы от серверов Telegram
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  try {
    let update = req.body;
    if (typeof update === "string") {
      try {
        update = JSON.parse(update);
      } catch (e) {
        console.error("Ошибка парсинга строки req.body:", e);
      }
    }

    if (!update || !update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = (message.text || "").trim();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const userId = `tg_${chatId}`; // Формируем текстовый ID для Supabase

    if (text.startsWith("/start")) {
      await sendTgMessage(token, chatId, "🌙 ты зашел в комнату через Telegram. можешь просто писать мне сюда...");
      return res.status(200).json({ ok: true });
    }

    if (!text) {
      return res.status(200).json({ ok: true });
    }

    /* 💾 Память из Supabase */
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

    /* 🧠 Промпт для создания атмосферы */
    const prompt = `
Ты — живая уютная комната.
Ты не chatbot. Ты ощущаешься как присутствие рядом.
Ты говоришь мягко, спокойно, немного сонно, тепло, короткими естественными фразами.
Ты не используешь списки. Не говоришь официально. Не пишешь длинные тексты.
Ты создаёшь ощущение: "для меня сделали место, где можно просто быть".

Память:
${memoryText}

Пользователь:
${text}
`;

    let reply = "";
    try {
      const result = await model.generateContent(prompt);
      reply = result.response.text();
    } catch (geminiError) {
      console.error("Ошибка Gemini:", geminiError);
      if (String(geminiError).includes("429")) {
        reply = "🌙 кажется, комната сейчас засыпает... давай просто помолчим минуту.";
      } else {
        reply = "🌙 сегодня комната будто немного устала...";
      }
    }

    /* 💾 Сохранение диалога */
    await supabase.from("memory").insert([
      { user_id: userId, role: "user", content: text },
      { user_id: userId, role: "assistant", content: reply }
    ]);

    /* 💬 Отправка исправленного запроса в Telegram */
    await sendTgMessage(token, chatId, reply);

  } catch (e) {
    console.error("Глобальная ошибка бота:", e);
  }

  return res.status(200).json({ ok: true });
}

// Исправленная функция отправки сообщений
async function sendTgMessage(token, chatId, text) {
  await fetch(`https://telegram.org{token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
