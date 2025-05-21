const user = require('../models/YoshUser');
const auth = require("./auth");


async function handleUserRegistration(req,res){
    var fileName = "";
    const body = req.body;
    const profileImage = req.file;
    const useremail = body.email;
    const existingUser = await user.findOne({ 'email' :useremail });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });
    if(profileImage)fileName = profileImage.filename;
    const adduser = await user.create({
        firstName: body.firstName,
        lastName: body.lastName,
        mobilePhone: body.mobilePhone,
        city:body.city,
        zipcode:body.zipcode,
        email: body.email,
        isProfessional: body.isProfessional,
        professionType: body.professionType,
        pimsCode: body.pimsCode,
        password: body.password,
        profileImage: fileName,
    });
    if(adduser){
        res.status(201).json({
            message: 'Registration completed successfully',
            data: adduser,
            
          });
    }
}

async function handleUserLogin(req,res){
    const body = req.body;
    const useremail = body.email;
    const existingUser = await user.findOne({ 'email' :useremail });
    if (!existingUser) return res.status(400).json({ error: 'Email does not Exists' });

        await auth.sendConfirmationCode(useremail, res);
}
async function handlehome(req,res){
   console.log('app is connected')
}

module.exports = {
    handleUserRegistration,
    handleUserLogin,
    handlehome
}