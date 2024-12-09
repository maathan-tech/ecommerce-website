const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    firstName:{
        type: String,
        required:true
    },
    lastName:{
        type:String,
        required:true
    },
    mobile:{
        type:String,
        required:false
    },
    email:{
        type: String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:false
    },
    profileImage:{
        type: String
    },
    googleId:{
        type:String,
        unique:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isVerified:{
        type: Boolean,
        default:false
    },
    otp:{
        type:String
    },
    otpExpires:{
        type:Date
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    
},{
    timestamps: true
});

module.exports = mongoose.model('User',userSchema)