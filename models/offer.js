const mongoose = require('mongoose')
const Category = require('./category')
const Product = require('./products')

const offerSchema = new mongoose.Schema({
    title:{
        type: String,
        required: true
    },
    type:{
        type:String,
        enum:['product','category','referal'],
        required:true
    },
    discount:{
        type: Number,
        required:true
    },
    isActive:{
        type: Boolean,
        default:true
    },
    startDate:{
        type:Date,
        required: true
    },
    endDate:{
        type:Date,
        required:true
    }
},{
    timestamps:true
})

offerSchema.statics.deactivateExpiredOffers = async function () {
    const now = new Date();
    try {
        // Find all expired and active offers
        const expiredOffers = await this.find({ endDate: { $lt: now }, isActive: true });

        console.log('expired offer:',expiredOffers)
        // Loop through each expired offer and deactivate it
        for (const offer of expiredOffers) {
            await offer.deactivateOffer();
        }

        console.log(`${expiredOffers.length} expired offers deactivated.`);
    } catch (error) {
        console.error('Error deactivating expired offers:', error);
    }
};

offerSchema.methods.deactivateOffer = async function () {
    if (!this.isActive) return;
    console.log(`Deactivating offer: ${this.title}`)

    this.isActive = false;
console.log(this._id)
    try {
        await Product.updateMany({offerId: this._id}, {
            $set: {
                offerApplied: false,
                offerDiscount: 0,
                offerId: null
            }
        });
       
        await Category.updateMany({offerId: this._id}, {
            $set: {
                offerApplied: false,
                offerDiscount: 0,
                offerId: null
            }
        });
        await this.save(); 
        console.log(`Offer "${this.title}" deactivated successfully.`);
    } catch (error) {
        console.error(`Error deactivating offer "${this.title}":`, error);
    }
};

module.exports = mongoose.model('Offer',offerSchema)