const mongoose = require('mongoose')

const walletSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance:{
        type:Number,
        default: 0
    },
    transcationHistory:[
        {
            status:{
                type: String,
                enum:['debit','credit'],
                required:true

            },
            amount:{
                type: Number,
                default: 0
            },
            description:{
                type:String,
                required: true
            },
            orderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Order' 
            },
            createdAt:{
                type: Date,
                default: Date.now
            }
        }
    ]

},{
    timestamps:true
})

module.exports = mongoose.model('Wallet',walletSchema)