export default async function handler(req,res){

const update = req.body;

const chatId =
update.message?.chat?.id;

const text =
update.message?.text || "";

const token =
process.env.TELEGRAM_BOT_TOKEN;

if(chatId){

await fetch(
`https://api.telegram.org/bot${token}/sendMessage`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id:chatId,
text:"🌙 комната услышала тебя."
})
}
);

}

return res.status(200).json({
ok:true
});

}
