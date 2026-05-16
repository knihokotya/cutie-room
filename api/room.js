import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res){

try{

const body = req.body || {};

const userId = body.userId;
const message = body.message;

if(!message){

return res.status(200).json({
reply:"🌙 комната тихо слушает..."
});

}

/* 💾 память */
const { data: history } = await supabase
.from("memory")
.select("*")
.eq("user_id", userId)
.order("created_at",{ascending:true})
.limit(20);

/* 🧠 AI */
const completion =
await openai.chat.completions.create({

model:"gpt-4o-mini",

messages:[

{
role:"system",
content:`

Ты — уютная живая комната.

Ты говоришь мягко, тихо, тепло.
Никогда не звучишь как chatbot.
Никогда не используешь списки.

Ты создаёшь ощущение:
кто-то рядом в тишине.

Ты немного скучаешь по человеку.
Иногда говоришь как пространство,
иногда как живое присутствие.

`
},

...(history || []).map(m => ({
role:m.role,
content:m.content
})),

{
role:"user",
content:message
}

]

});

const reply =
completion.choices[0].message.content;

/* 💾 сохраняем */
await supabase.from("memory").insert([

{
user_id:userId,
role:"user",
content:message
},

{
user_id:userId,
role:"assistant",
content:reply
}

]);

return res.status(200).json({
reply
});

}catch(e){

console.log(e);

return res.status(500).json({
reply:"🌙 сегодня комната будто немного сонная..."
});

}

}
