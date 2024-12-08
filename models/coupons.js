const mongoose = require('mongoose')

const couponSchema = new mongoose.Schema({
    couponCode:{
        type:String,
        required:true,
        unique: true
    },
    discount:{
        type:Number,
        required: true,
    },
    usageLimit:{
        type:Number,
        required: true
    },
    usedCount:{
        type:Number,
        default:0
    },
    expDate:{
        type:Date,
        required:true
    },
    isActive:{
        type:Boolean,
        default:true
    }
},{
    timestamps: true
})

module.exports = mongoose.model('Coupon',couponSchema)