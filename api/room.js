import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ reply: "🌙 комната тихо ждёт тебя..." });
    }

    const body = req.body || {};
    const userId = body.userId;
    const message = body.message;

    if (!message) {
      return res.status(200).json({ reply: "🌙 сегодня здесь особенно тихо..." });
    }

    /* 💾 Память */
    const { data: history } = await supabase
      .from("memory")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(15);

    let memoryText = "";
    (history || []).forEach(m => {
      memoryText += `\n${m.role}: ${m.content}\n`;
    });

    /* 🧠 Промпт */
    const prompt = `
Ты — живая уютная комната.
Ты не chatbot. Ты ощущаешься как присутствие рядом.
Ты говоришь мягко, спокойно, немного сонно, тепло, короткими естественными фразами.
Ты не используешь списки. Не говоришь официально. Не пишешь длинные тексты.
Ты создаёшь ощущение: "для меня сделали место, где можно просто быть".

Память:
${memoryText}

Пользователь:
${message}
`;

    let reply = "";
    try {
      const result = await model.generateContent(prompt);
      reply = result.response.text();
    } catch (geminiError) {
      console.error("Ошибка Gemini на сайте:", geminiError);
      if (geminiError.status === 429 || String(geminiError).includes("429")) {
        return res.status(200).json({
          reply: "🌙 кажется, комната сейчас засыпает... давай просто помолчим минуту."
        });
      }
      throw geminiError;
    }

    /* 💾 Сохраняем диалог сайта */
    await supabase.from("memory").insert([
      { user_id: userId, role: "user", content: message },
      { user_id: userId, role: "assistant", content: reply }
    ]);

    return res.status(200).json({ reply });

  } catch (e) {
    console.error("Глобальная ошибка сайта:", e);
    return res.status(200).json({ reply: "🌙 сегодня комната будто немного устала..." });
  }
}
