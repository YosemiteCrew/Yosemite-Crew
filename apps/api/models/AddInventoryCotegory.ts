import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    category:{
        type: String,
        require: true,
    },
    bussinessId:{
        type:String,
        require: true,
    }
})

export const InventoryCategory = mongoose.model("InventoryCategory", Schema)


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

export const InventoryManufacturer = mongoose.model("InventoryManufacturer", manufacturerSchema)

const ItemCategorySchema = new mongoose.Schema({
    itemCategory:{
        type: String,
        required: true,
    },
    bussinessId:{
        type:String,
        require: true,
    }
})

export const InventoryItemCategory = mongoose.model("InventoryItemCategory", ItemCategorySchema)

const ProcedureCategorySchema = new mongoose.Schema({
    category:{
        type: String,
        required:true
    },
    bussinessId: {
        type:String,
        required:true,
    }
})

export const ProcedureCategory = mongoose.model("ProcedureCategory",ProcedureCategorySchema)
