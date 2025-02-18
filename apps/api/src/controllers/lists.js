const WebUsers = require('../models/WebUser');


async function handlelists(req, res) {
 
     const filterVal = req.body.filter;
     const getLists = await WebUsers.find({businessType:filterVal});
     console.log(getLists)

    

}   
module.exports = {
    handlelists,
}
