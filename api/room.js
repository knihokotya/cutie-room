export default async function handler(req, res){

if(req.method !== "POST"){
return res.status(200).json({
reply:"🌙 комната слушает тишину..."
});
}

const body = req.body || {};

const message = body.message || "";

const replies = [

"🌙 я рядом.",

"💛 иногда можно просто посидеть в тишине.",

"🌧 сегодня комната звучит немного тише обычного.",

"✨ мне кажется, тебе идёт этот свет.",

"🌙 я запомнила это.",

"💗 ты можешь остаться здесь сколько захочешь.",

"🌧 за окном будто начинается дождь.",

"✨ иногда мир становится легче ночью."

];

const random =
replies[Math.floor(Math.random()*replies.length)];

return res.status(200).json({
reply: random
});

}
