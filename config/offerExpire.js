const cron = require('node-cron')
const Offer = require('../models/offer')

const startOfferExpirationJob = ()=>{
cron.schedule('0 0 * * *',async ()=>{
    console.log('checking for expired offers....');
    
    try {
        const now = new Date()
        const expiredOffer = await Offer.find({ endDate:{$lt:now}, isActive:true })
        
        for(const offer of expiredOffer){
            await offer.deactivateOffer()
            console.log(`Deactivated offer: ${offer.title}`)
        }

        console.log('Expired offers processed successfully');
        
    } catch (error) {
        console.log('Error processing expired offers',error)
        
    }
})
}

module.exports = startOfferExpirationJob