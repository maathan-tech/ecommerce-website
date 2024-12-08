const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items:[
        {
            product:{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                min: 1
            },
            price:{
                type: Number,
                required: true,
            }
        }
    ],
    totalPrice:{
        type: Number,
        required: true,
        min: 0
    },
    shippingAddress:{
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
        
    },
    paymentMethod:{
        type: String,
        enum: ['Online-payment', 'cod','Wallet'],
        required:true,
    },
    razorpayPaymentId:{
        type: String
    },
    razorpaySignature:{
        type:String
    },
    razorpayOrderId:{
        type: String,
        required: function(){ return this.paymentMethod === 'Online-payment'}
    },
    paymentStatus:{
        type: String,
        enum: ['pending','paid','failed'],
        default: 'pending'
    },
    returnStatus:{
        type: String,
        enum: ['not-request','pending','approved','rejected'],
        default: 'not-request'
    },
    returnReason:{
            type:String,
    },
    status:{
        type: String,
        enum:['pending','paid','shipped','Delivered','Cancelled','Returned'],
        default: 'pending',
    },
    couponCode:{
        type: String,
    },
    discountAmount:{
        type: Number,
        default:0
    },
    totalPriceAfterDiscount:{
        type: Number,
        required: true,
        min:0
    },
    shipping:{
        type:Number
    }
    
},
    {
        timestamps: true,
    }
)

module.exports = mongoose.model('Order',orderSchema)