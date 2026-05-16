export default async function handler(req, res){

console.log("Telegram update:", req.body);

return res.status(200).json({
ok:true
});

}
