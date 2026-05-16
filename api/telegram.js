export default async function handler(req,res){

const update = req.body;

console.log(update);

return res.status(200).json({
ok:true
});

}
