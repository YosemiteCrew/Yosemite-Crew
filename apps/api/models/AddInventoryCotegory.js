const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
    cotegory:{
        type: String,
        require: true,
    },
    bussinessId:{
        type:String,
        require: true,
    }
})

const InventoryCategory = mongoose.model("InventoryCategory", Schema)


const manufacturerSchema = new mongoose.Schema({
    manufacturer:{
        type: String,
        required : true,
    },
    bussinessId:{
        type:String,
        require: true,
    }
})

const InventoryManufacturer = mongoose.model("InventoryManufacturer", manufacturerSchema)

const ItemCategorySchema = new mongoose.Schema({
    itemCotegory:{
        type: String,
        required: true,
    },
    bussinessId:{
        type:String,
        require: true,
    }
})

const InventoryItemCategory = mongoose.model("InventoryItemCategory", ItemCategorySchema)

module.exports = {InventoryCategory,InventoryManufacturer,InventoryItemCategory}