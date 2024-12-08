const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    image:String,
    isDeleted:{
        type:Boolean,
        default:false
    },
    offerApplied:{
        type:Boolean,
        default:false
    },
    offerId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Offer',
        default:null
    },
    offerDiscount:{
        type:Number,
        default:0
    }
  
},{
    timestamps: true
})

module.exports = mongoose.model('Category',categorySchema);
