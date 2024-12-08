const mongoose = require('mongoose')

const addressSchema = new mongoose.Schema({
   user:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
   },
    firstName:{
        type:String,
        required:true
    },
    lastName:{
        type:String,
        required:true
    },
    mobile:{
        type:String,
        required:true
    },
   
    street:{
        type: String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    zipcode:{
        type:String,
        required:true
    },
    country:{
        type:String,
        required:true
    },
    isDefault:{
        type:Boolean,
        default:false
    }
},{timestamps:true});

module.exports = mongoose.model('Address',addressSchema)