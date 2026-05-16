import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const BOT = process.env.TELEGRAM_BOT_TOKEN;

/* 💬 Telegram */
async function tg(chatId, text){
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

export default async function handler(req, res){

  const { mode, message, userId } = req.body;

  /* 👤 ищем пользователя */
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", userId)
    .single();

  /* =====================
     💬 ЧАТ
  ====================== */
  if(mode === "chat"){

    /* 🧠 память */
    const { data: history } = await supabase
      .from("memory")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(30);

    const completion = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[
        {
          role:"system",
          content:`
Ты — комната, которая существует отдельно для каждого пользователя.
Ты помнишь только его.
Ты мягкая, тихая, немного скучаешь.

Твоя привязанность: ${user?.affection || 0}
`
        },
        ...(history || []).map(m => ({
          role: m.role,
          content: m.content
        })),
        { role:"user", content: message }
      ]
    });

    const reply = completion.choices[0].message.content;

    /* 💾 сохраняем память */
    await supabase.from("memory").insert([
      { user_id: userId, role:"user", content:message },
      { user_id: userId, role:"assistant", content:reply }
    ]);

    /* 💗 обновляем состояние */
    await supabase.from("users").upsert({
      user_id: userId,
      affection: (user?.affection || 0) + 1,
      last_seen: new Date().toISOString()
    });

    /* 💬 Telegram (если подключён) */
    if(user?.linked){
      await tg(user.telegram_chat_id, "🌙 " + reply);
    }

    return res.json({ reply });
  }

  /* =====================
     🌙 авто-сообщение
  ====================== */
  if(mode === "auto"){

    if(user?.linked){

      const msg =
        user.affection > 5
          ? "я немного привыкла к тебе..."
          : "я всё ещё здесь, если ты вернёшься";

      await tg(user.telegram_chat_id, "🌙 Комната:\n\n" + msg);
    }

    return res.json({ ok:true });
  }

  res.json({ ok:false });
}
