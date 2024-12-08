const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    price:{
        type:Number,
        required:true
    },
    description:{
        type:String
    },
    images:[{type:String, required:true}],
    isDeleted:{
        type:Boolean,
        default:false
    },
    category:{
        type:mongoose.Schema.Types.ObjectId,ref: 'Category', required:true
    },
    stock:{
        type:Number,
        required:true
    },
    offerDiscount:{
        type:Number,
        default:0
    },
    offerApplied:{
        type: Boolean,
        default:false

    },
    offerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Offer',
        default: null
    }

},
    {
        timestamps: true
    }
)

productSchema.virtual('priceAfterDiscount').get(function(){
    if(this.offerApplied && this.offerDiscount > 0){
        const discountAmount = (this.price * this.offerDiscount)/100;
        return this.price - discountAmount
    }
    return this.price
})


productSchema.virtual('discountAmount').get(function() {
    if (this.offerApplied && this.offerDiscount > 0) {
        return (this.price * this.offerDiscount) / 100;
    }
    return 0;
});

module.exports = mongoose.model('Product',productSchema)