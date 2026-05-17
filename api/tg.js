export default async function handler(req, res) {
  // Нам нужны только POST запросы от Telegram
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  try {
    // 🛠 НАДЕЖНЫЙ ПАРСИНГ BODY (Защита от неопознанных JSON от Telegram)
    let update = req.body;
    if (typeof update === "string") {
      try {
        update = JSON.parse(update);
      } catch (e) {
        console.error("Не удалось распарсить строку body:", e);
      }
    }

    // Если в запросе нет сообщения, просто тихо выходим
    if (!update || !update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = (message.text || "").trim();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const userId = `tg_${chatId}`;

    // Перехватываем команду /start
    if (text.startsWith("/start")) {
      await sendTgMessage(token, chatId, "🌙 ты зашел в комнату через Telegram. можешь просто писать мне сюда...");
      return res.status(200).json({ ok: true });
    }

    // Если текста нет (например, прислали стикер), выходим
    if (!text) {
      return res.status(200).json({ ok: true });
    }

    /* 💾 Работа с Supabase и Gemini (Остается без изменений) */
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

    const prompt = `Ты — живая уютная комната. Говоришь мягко, коротко.\nПамять:\n${memoryText}\nПользователь:\n${text}`;

    let reply = "";
    try {
      const result = await model.generateContent(prompt);
      reply = result.response.text();
    } catch (geminiError) {
      reply = "🌙 сегодня комната будто немного устала...";
    }

    // Сохраняем в базу данных
    await supabase.from("memory").insert([
      { user_id: userId, role: "user", content: text },
      { user_id: userId, role: "assistant", content: reply }
    ]);

    // Отправляем в Телеграм
    await sendTgMessage(token, chatId, reply);

  } catch (e) {
    console.error("Глобальная ошибка бота:", e);
  }

  // Telegram ВСЕГДА должен получить 200 ОК, даже если код упал внутри
  return res.status(200).json({ ok: true });
}

async function sendTgMessage(token, chatId, text) {
  await fetch(`https://telegram.org{token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
