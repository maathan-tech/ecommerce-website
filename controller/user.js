const bcrypt = require('bcryptjs')
const User = require('../models/user')
const sendEmail = require('../utils/sendOtp')
const generateOTP = require('../utils/otpHelper')
const Category = require('../models/category')
const Products = require('../models/products')
const Address = require('../models/address')
const address = require('../models/address')
const { singleUpload } = require('../config/multerConfig')
const { generateToken, verifyToken } = require('../utils/jwtHelper')
const Cart  = require('../models/cart')
const Order = require('../models/orders')
const mongoose = require('mongoose')
const Wishlist = require('../models/wishlist')
const razorpay = require('../utils/razorpay')
const crypto = require('crypto')
const Wallet = require('../models/wallet')
const Coupons = require('../models/coupons')
const { disconnect } = require('process')
const PDFDocument = require('pdfkit')


//Display signup
exports.showSignup  = (req,res)=>{
    try {
        res.render('user/signup')
    } catch (error) {
        console.log("Error rendering signup page:",error.message)
        res.status(500).json({ success:false, message: "Unable to load the signup page. Please try again later"})
    }
   
}

//Handle signup
exports.signup = async (req,res) => {
   
    try {
        const { firstName, lastName, mobile, email, password, confirmPassword } = req.body;


        // Checks if passwords match
        if(password !== confirmPassword){
            return res.status(400).json({ success:false, message:'Passwords do not match'})
        }

        let existingUser = await User.findOne({email})
        if(existingUser) return res.status(400).json({success:false, message:'Email already exists'})
          
        //Hashed password
        const hashedPassword = await bcrypt.hash(password,10);

        //generate OTP and expiration time
        const otp = generateOTP()
        const otpExpires = new Date(Date.now()+ 5 * 60 * 1000);

        //create user    
        const user = new User({firstName,lastName,mobile,email,password: hashedPassword,otp,otpExpires,isVerified:false})
        await user.save()

        //send OTP email
        await sendEmail(email, 'Your OTP for Signup Verification', `Your OTP is ${otp}, valid for 5 minutes`);

        res.status(200).json({
            success: true,
            message:'OTP sent successfully. Please check your mail',
            email
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success:false,
            message:'An error occured during signup. Please try again'
        })
        
    }
}

//Show otp page
exports.showOtp = (req, res) => {
    try {
        const { email } = req.query;
        const errorMessage = req.query.error || null;  
        const successMessage = req.query.success || null;  
        res.render('user/otp', { email, errorMessage, successMessage });
    } catch (error) {
        console.log('Error rendering otp page:',error.message)
        res.status(500).json({ success:false, message:'Unable to load OTP page. Please try again'})
    }
};

//verify otp
exports.verifyOtp = async (req, res) => {

    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success:false, message:'User not found'})
        }
        if (user.isVerified) {
            return res.status(400).json({ success:false, message:'User already verified'})
        }

        if (user.otp === otp && user.otpExpires > Date.now()) {
            user.isVerified = true;
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();

            req.session.otpVerified = true;

            return res.status(200).json({success: true, message: 'OTP verified successFully. Please LOGIN'})
        } else {
            return res.status(400).json({ success:false, message:'Invalid or expired OTP'})
        }
    } catch (error) {
        console.error('Error in otp verification',error.message);
        res.status(500).json({ success:false, message:'Something went wrong during otp verification. Please try again'})
    }
};


//resend OTP
exports.resendOtp = async (req, res) => {

    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user || user.isBlocked) {
            return res.status(400).json({ success:false, message:'User not found or blocked'})
        }

        if (user.isVerified) {
            return res.status(400).json({ success:false, message:'Your account already verified'})
        }

        // Generate a new OTP and update it in the user document
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

        user.otp = otp;
        user.otpExpires = otpExpires;

        await user.save();
        await sendEmail(user.email, 'Your OTP for Signup Verification', `Your OTP is ${otp}, valid for 5 minutes`);

        res.status(200).json({ success:true, message:'OTP resent successfully. Please check your email',email})

    } catch (error) {
        console.error('Error while resend OTP',error.message);
        res.status(500).json({ success:false, message:'An unexpected error occured. please try again later'})
    }
}

//display forgotpassword
exports.showForgotpassword = async(req,res)=>{
    try {
        res.render('user/forgotpassword')
    } catch (error) {
        console.log(error);
        res.status(500).json({success:false, message:'Unable to load forgetpassword page. please try again later'})
        
    }
}


//forget Password
exports.requestPasswordReset = async(req,res)=>{
    const { email } = req.body;
    try {
        const user = await User.findOne({ email })
        if(!user){
            return res.status(404).json({ success:false, message: "User with this email doesn't exist." });
        }

        //Generate a token and save to user
        const token = generateToken({ userId:user._id })
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save()

        //send reset email
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`
        await sendEmail(user.email, 'Password Reset', `Reset your password here: ${resetLink}`);
        res.status(200).json({ success:true, message: "Password reset email sent!" });

    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message: "Error requesting password reset." });
    }
}

//show reset page
exports.showResetPassword = async(req,res)=>{
    try {
        res.render('user/resetPassword')
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in loading reset password page'})
    }
}

exports.resetPassword = async(req,res)=>{
  
    try {

        const { token } = req.params;
        const { newPassword } = req.body;
    
        
    
        if (!token) {
            return res.status(400).json({ success:false, message: "Token not provided in the URL." });
        }

        const decoded = verifyToken(token)
        console.log(decoded)
        const user = await User.findOne({
            _id: decoded.userId,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if(!user){
            return res.status(400).json({success:false, message: "Invalid or expired token." });
 
        }

        //save new password and clear token fields
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save()

        res.status(200).json({success:true, message: "Password reset successfully!" });
        // res.redirect('/login')
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message: "Error in resetting password." });
    }
}

//Show login
exports.showLogin = (req, res) => {
    try {
      
        const showResend = req.query.showResend === 'true';
        const email = req.query.email || '';

        res.render('user/login', { showResend, email });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in loading login page'})
    }
};


//Handle login
exports.login = async (req,res) => {
    const {email , password } = req.body;
    

    try {
        const user = await User.findOne({ email, isBlocked: false });
        if (!user) return res.status(400).json({ success:false, message:'User not found or blocked'})

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message:'Incorrect password'})

        if (!user.isVerified) {
            // User is not verified
           return res.status(400).json({ success:false, message:'User not verified, Please verify with otp and login again', email, showResend : true })
        }

        req.session.user = {id: user._id, role: 'user'}
        res.status(200).json({ success:true, message:'Login successfully'})
    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message:'Error in login. please try again later'})
        
    }
}


//Show homepage
exports.showHome = async(req,res)=>{
    try {
        const userId = req.session.user?.id
        const user = await User.findById(userId).lean()
        const categories = await Category.find({isDeleted:false})
        const products = await Products.find({isDeleted:false}).sort({createdAt: -1}).limit(8)
                .populate({
                    path:'category',
                    match: { isDeleted: false }
                }).exec()

        const filteredProducts = products.filter(product => product.category)
        
        res.render('user/home',{categories, products: filteredProducts, userId:userId || null, user:user || null})
       
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: 'An error occurred while loading the homepage. Please try again later.'
        });
        
    }
}

//show all products 
exports.allProducts = async(req,res)=>{
    try {

        const { category, sort, search } = req.query;
        const filter = { isDeleted: false}

        const activeCategories = await Category.find({ isDeleted: false})

        //apply category filter
        if(category){
            filter.category = category;
        }else {
            filter.category = { $in: activeCategories.map(cat => cat._id) }
        }

        if(search){
            const searchRegex = new RegExp(search, 'i')
            filter.name = searchRegex
        }

        //fetch products with applied filters
        let productQuery = Products.find(filter)

        //sort based on selected option
        if(sort === 'price-asc'){
            productQuery = productQuery.sort({ price: 1})
        }else if(sort === 'price-desc'){
            productQuery = productQuery.sort({ price : -1})
        }else if(sort === 'name-asc'){
            productQuery = productQuery.sort({ name: 1}).collation({ locale: "en", strength: 2 });
        }else if(sort === 'name-desc'){
            productQuery = productQuery.sort({ name: -1}).collation({ locale: "en", strength: 2 });
        }


        const products = (await productQuery.exec()).reverse()
        
        const user = req.session.user
        res.render('user/listAllProducts',{ products,categories:activeCategories, user: user || null, sort: sort || '', search: search || '', selectedCategory: category || ''})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in displaying all products'})
    }
}

//show product details
exports.showProductDetails = async(req,res)=>{
    try {

        const user = req.session.user;
        const product = await Products.findById(req.params.id).populate('category')
        if(!product){
            return res.status(400).json({ success:false, message:'Product not found'})
        }

        //Related Products
        const relatedProducts = await Products.find({
            isDeleted:false,
            category: product.category,
            _id: { $ne: product._id },
        }).limit(4);

        res.render('user/productDetails',{product,relatedProducts,user:user || null})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in showing product details'})
    }
}

//show user profile
exports.showUserdashboard = async(req,res)=>{
    try {
        const userId = req.session.user?.id;
        if (!userId) {
            return res.status(400).json({ success:false, message:'User not authentiacate'})
        }

        const user = await User.findById(userId).lean()
        const defaultAddress = await Address.findOne({user: req.session.user.id,isDefault:true})
        const orders = await Order.find({ user: req.session.user.id }).limit(3).sort({ createdAt: -1 })
        if(!user){
            return res.status(400).json({ success:false, message:'User not found'})
        }
        const ordersWithDetails = orders.map(order => {
            const totalQuantity = order.items.reduce((total, item) => total + item.quantity, 0);
            const totalAmount = order.totalPriceAfterDiscount
                
                return { 
                  ...order.toObject(), 
                  totalQuantity, 
                  totalAmount 
                };
              });
    
        
        res.render('user/userDashboard',{user,defaultAddress,orders:ordersWithDetails})
    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message:'Error while displaying dashboard'})
    }
}

//show orders
exports.showOrderdetails = async(req,res)=>{

    const page = parseInt(req.query.page) || 1; 
    const limit = 10; 
    const skip = (page - 1) * limit; 

    try {
        
        const orders = await Order.find({ user: req.session.user.id }).populate('items.product').skip(skip).limit(limit).sort({ createdAt: -1 })
        const ordersWithDetails = orders.map(order => {
        const totalQuantity = order.items.reduce((total, item) => total + item.quantity, 0);
        const totalAmount = order.totalPriceAfterDiscount
      
            // Return the order object with added totalQuantity and totalAmount
            return { 
              ...order.toObject(), 
              totalQuantity, 
              totalAmount 
            };
          });

        const totalOrders = await Order.countDocuments({});
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('user/userOrders',{ orders:ordersWithDetails, currentPage: page, totalPages: totalPages })
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message:'Error in fetching orders'})
        
    }
}

//get order details
exports.getOrderDetails = async(req,res)=>{
   

    try {
        const { orderId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send('Invalid order ID');
        }
        
        const order = await Order.findById(orderId).populate('items.product','name price images priceAfterDiscount').populate('user','name email').populate('shippingAddress');
        if (!order) {
            return res.status(400).json({
                success:false,
                message:'Order not found'
            })
          }

        res.render('user/orderDetails',{ order })
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ success:false, message:'Error while fetching the order details' })
    }

}

//cancel the order
exports.cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find the order and check if it can be cancelled
        const order = await Order.findById(orderId).populate('items.product');
        
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === 'Cancelled' || order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: "Order already cancelled or deliverd the product" });
        }

        // Update the order status to "Cancelled"
        order.status = 'Cancelled';
        await order.save();


        //restore stock for each item in order
        for( const item of order.items){
            if(item.product){
                const product = item.product
                product.stock += item.quantity
                await product.save()
            }
        }

       // Handle refund if payment was online
       if ((order.paymentMethod === 'Online-payment' && order.paymentStatus === 'paid') || order.paymentMethod === 'Wallet') {
        let wallet = await Wallet.findOne({ user: order.user });

        if (!wallet) {
            // Create a new wallet if not found
            wallet = new Wallet({
                user: order.user,
                balance: 0,
                transcationHistory: []
            });
            await wallet.save();
            console.log(`Created new wallet for user ${order.user}`);
        }

        const creditAmount = order.totalPriceAfterDiscount;
        wallet.balance += creditAmount;
        wallet.transcationHistory.push({
            status: 'credit',
            amount: creditAmount,
            description: `Refund for cancelled order ${orderId}`,
            createdAt: Date.now()
        });
        await wallet.save();

        return res.json({ success: true, message: 'Order cancelled. Refund credited to your wallet.' });
    }
    res.json({ success: true, message: "Order cancelled successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error cancelling the order" });
    }
};

//return order
exports.returnOrder = async(req,res)=>{
    try {
        const { orderId } = req.params
        const { reason } = req.body
       
        
        
        const order = await Order.findByIdAndUpdate(orderId, {returnStatus:'pending', returnReason : reason})
        if(!order){
            res.status(400).json({ success:false, message : 'No Order found'})
        }

        await order.save()

       

        res.status(200).json({ success:true, message:'Order Return request submitted'})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message:'something went wrong in return'})
    }
}

//download invoice
exports.getInvoice = async (req, res) => {

    try {
        const { orderId } = req.params;
        const userId = req.session.user.id;

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('items.product');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

       
        const doc = new PDFDocument();
        
       
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice_${orderId}.pdf"`);

        doc.pipe(res);

       
        doc.fontSize(20).text('Order Invoice', { align: 'center' });
        doc.moveDown();

       
        doc.fontSize(12).text(`Order ID: ${order._id}`);
        doc.text(`Order Date: ${order.createdAt.toDateString()}`);
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Shipping Address:`);
        doc.text(`${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`);
        doc.text(`${order.shippingAddress.street}`);
        doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zipcode}`);
        doc.text(`${order.shippingAddress.country}`);
        doc.text(`Mobile: ${order.shippingAddress.mobile}`);
        doc.moveDown();

        
        doc.fontSize(16).text('Products:', { underline: true });
        doc.moveDown();

        
        doc.fontSize(14).text('Name                      Quantity        Price', { align: 'left' });
        doc.text('----------------------------------------------------------');
        
        
        order.items.forEach(item => {
            const formattedPrice = `₹${item.price.toLocaleString()} Rs`;
            doc.text(
                `${item.product.name.padEnd(24)} ${String(item.quantity).padStart(8)} ${formattedPrice.padStart(10)}`
            );
        });

        doc.moveDown();

        
        const formattedTotalPrice = `₹${order.totalPrice.toLocaleString()}`;
        const formattedDiscount = `₹${order.discountAmount.toLocaleString()}`;
        const formattedFinalAmount = `₹${order.totalPriceAfterDiscount.toLocaleString()}`;

        doc.text(`Total Price: ${formattedTotalPrice} Rs`);
        doc.text(`Discount: ${formattedDiscount} Rs`);
        doc.text(`Final Amount: ${formattedFinalAmount} Rs`, { bold: true });

        
        doc.end();

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error generating invoice' });
    }
};

//show user addressbook
exports.showAddressbook = async(req,res)=>{
    try {
        const addresses = await Address.find({user: req.session.user.id})
        res.render('user/addressbook',{addresses})
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(500).json({ success:false, message:'Error in displaying addressbook'})
    }
}

//Add new address
exports.addAddress = async(req,res)=>{
    try {
        const { firstName, lastName, street, city, state, country, zipcode, mobile } = req.body
        
        const newAddress = new Address({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            country: country.trim(),
            zipcode: zipcode.trim(),
            mobile: mobile.trim(),
            user: req.session.user.id
        });

        await newAddress.save();
        res.status(200).json({ success:true, message:'New address addedd'})

    } catch (error) {
        console.error("Error adding address:", error);
        res.status(500).json({ success:false, message:'Could not add address'})
    }
}

//Default addresss
exports.setDefaultAddress = async(req,res)=>{
    try {
       
        await Address.updateMany({user: req.session.user.id},{isDefault:false})

        await address.findByIdAndUpdate(req.params.id,{isDefault:true})
        res.status(200).json({ success: true, message:'Default address set successfully'})
    } catch (error) {
        console.error("Error setting default address:", error);
        res.status(500).json({ success:false, message:'Error in set address default'})
    }
}

//show edit address
exports.getEditAddress = async(req,res)=>{
    try {
        const address = await Address.findById(req.params.id)
        res.render('user/editAddress',{address})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in displaying edit address'})   
    }
}
//edit address 
exports.editAddress = async(req,res)=>{
    try {
        
        const {id} = req.params;
        const trimmedData = {
            firstName: req.body.firstName?.trim(),
            lastName: req.body.lastName?.trim(),
            street: req.body.street?.trim(),
            city: req.body.city?.trim(),
            state: req.body.state?.trim(),
            country: req.body.country?.trim(),
            mobile: req.body.mobile, 
            zipcode: req.body.zipcode, 
        }

        const updateAddress = await Address.findOneAndUpdate({_id:id, user: req.session.user.id},trimmedData,{new:true})
        if(!updateAddress){
           res.status(400).json({ success:false, message:'Address not found'})
        }
        res.status(200).json({ success:true, message:'Address updated successfully'})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error while updating the address'})
    }
}

//delete address
exports.deleteAddress = async(req,res)=>{
    try {
        const { id } = req.params;
        const addressToDelete = await Address.findOne({ _id: id, user: req.session.user.id });

        if (!addressToDelete) {
           return res.status(400).json({ success:false, message:'No address found '})
        }
        if (addressToDelete.isDefault) {
            return res.status(400).json({ success:false, message:'Default address cannot delete, You can edit it'})
        }

        await Address.findOneAndDelete({ _id: id, user: req.session.user.id });
        res.status(200).json({ success:true, message: 'Address deleted successfully'})
    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).json({ success:false, message:'Error occured while deleting...'})
    }
}

//show user profile
exports.showProfile = async(req,res)=>{
    try {
        const userId = req.session.user?.id;
        if (!userId) {
            return res.status(400).json({ success: false, message:'User not authenticate'})
        }

        const user = await User.findById(userId).lean()
        if(!user){
            return res.status(400).json({ success: false, message: 'User not found'})
        }
        res.render('user/userProfile',{user })
        
    } catch (error) {
        console.error("Error loading profile:", error);
        res.status(500).json({ success:false, message:'Error occured while displaying user profile'})
        
    }
}

//update User profile image
exports.uploadProfileImage = (req, res) => {
    singleUpload(req, res, async (err) => {
        if (err) {
            console.log(err);
            return res.status(400).json({ success:false, message:'Error in uploading image'})
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please select a file'})
        }

        try {
            const profileImageUrl = `/uploads/${req.file.filename}`;
            const updatedUser = await User.findByIdAndUpdate(req.session.user.id, 
                { profileImage: profileImageUrl }, 
                { new: true }
            ).lean();

         res.status(200).json({ success: true, message:'Profile pic updated successfully', updatedUser})
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, message:'Could not update pic. please try again'})
        }
    });
};

//update Profile
exports.updateProfile = async(req,res)=>{
    try {
        const trimmedData = { firstName: req.body.firstName?.trim(), lastName: req.body.lastName?.trim(), mobile: req.body.mobile }
        await User.findByIdAndUpdate(req.session.user.id, { trimmedData })
        res.status(200).json({ success:true, message:'Profile updated successfully'})

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ success:false, message:'Error occured while updating profile'})
    }
}

//change password
exports.changePassword = async(req,res)=>{
    try {
        const {currentPassword, newPassword, confirmPassword } = req.body

        const user = await User.findById(req.session.user.id)

        
        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if(!isMatch) return res.status(400).json({ success:false, message:'Current password is not correct'})

        if (newPassword !== confirmPassword) return res.status(400).json({ success:false, message:'Password does not match'})

        
        user.password = await bcrypt.hash(newPassword,10)
        await user.save()
       res.status(200).json({ success:true, message:'Password changed successfully'})

    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ success:false, message:'Error in changing password'})
    }
}

//show wallet
exports.showWallet = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Check if wallet exists, create one if not
        let wallet = await Wallet.findOne({ user: userId })
            .populate('user', 'name')
            .populate({
                path: 'transcationHistory.orderId',
                populate: {
                    path: 'items.product',
                    select: 'name',
                },
            });

        if (!wallet) {
            wallet = new Wallet({
                user: userId,
                balance: 0,
                transcationHistory: [],
            });
            await wallet.save();
        }

        // Handle pagination
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 10; 
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const totalTransactions = wallet.transcationHistory.length;
        const paginatedTransactions = wallet.transcationHistory
            .slice()
            .reverse() 
            .slice(startIndex, endIndex) 
            .map((transaction) => ({
                orderId: transaction.orderId ? transaction.orderId._id : 'N/A',
                status: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1),
                amount: typeof transaction.amount === 'number' ? transaction.amount : 0,
                description: transaction.description,
                createdAt: transaction.createdAt,
            }));

        res.render('user/wallet', {
            walletBalance: wallet.balance,
            transcationHistory: paginatedTransactions,
            currentPage: page,
            totalPages: Math.ceil(totalTransactions / limit),
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};


//show wishlist
exports.getWishlist = async(req,res)=>{
    try {
        const userId = req.session.user.id
        let wishlist = await Wishlist.findOne({ user: userId }).populate('products').exec()

        if(!wishlist){
            wishlist = new Wishlist({
                user: userId,
                products: []
            })   
            await wishlist.save()
        }


        res.render('user/wishlist',{ products: wishlist.products})
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Error fetching wishlist' });
        
    }
}

//count wishlist product
exports.getWishlistCount = async (req,res) =>{
    try {
        const userId = req.session.user?.id
        if(!userId) return res.json({ wishlistCount: 0})
        
        const wishlist = await Wishlist.findOne({ user: userId})
        const wishlistCount = wishlist ? wishlist.products.length : 0

        res.json({ wishlistCount })
    } catch (error) {
        console.log('Error fetching cart count:',error);
        res.status(500).json({ wishlistCount: 0})
        
    }
}

//add product to wishlist
exports.addToWishlist = async(req,res)=>{
    try {
        const { productId } = req.body;
        const userId = req.session.user.id

        let wishlist  = await Wishlist.findOne({ user: userId });
        if(!wishlist){
            wishlist = await Wishlist.create({ user:userId, products: []})
        }

        if(!wishlist.products.includes(productId)){
            wishlist.products.push(productId);
            await wishlist.save()
            return res.status(200).json({ message: 'Product added to wishlist',type: 'success'});
        }else {
            return res.status(400).json({ message: 'Product already in wishlist',type: 'warning' });
        }
        
       
    } catch ({error}) {
        res.status(500).json({ error: 'Error adding product to wishlist'})
    }
}

//remove from wishlist 
exports.removeFromWishlist = async(req,res)=>{
    try {
        const { productId } = req.body
        const userId = req.session.user.id

        const wishlist = await Wishlist.findOne({ user: userId })
        if(wishlist){
            wishlist.products = wishlist.products.filter(id => id.toString() !== productId)
            await wishlist.save()
        }   

        res.status(200).json({ message: 'Product removed from wishlist '})
    } catch (error) {
        res.status(500).json({ error: 'Error removing product from wishlist '})
        
    }
}

//add product from wishlist to cart
exports.addToCartFromWishlist = async(req,res)=>{
    try {
        const { productId } = req.body
        const userId = req.session.user.id

        //add to cart
        let cart = await Cart.findOne({ user:userId })
        if(!cart){
            cart = await Cart.create({ user:userId , items: []})
        }

        const existingItem = cart.items.find(item => item.product.equals(productId));        
        if(existingItem){
            return res.status(200).json({ message: 'Product already in cart',type:'warning' });
        }else {
            cart.items.push({ product: productId , quantity: 1})
    
        await cart.save()

        res.status(200).json({ message: 'Product added to cart ' ,type: 'success'})
    }
    } catch (error) {
        res.status(500).json({ error: 'Error moving product to cart '})
    }
}

//show shopping cart 
exports.showShoppingCart = async(req,res)=>{
    try {
        const cart = await Cart.findOne({ user: req.session.user.id}).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.render('user/shoppingCart', { cart: null });
        }

        const shippingCost = 50
        cart.totalPrice = cart.items.reduce((acc, item) => {
            if (item.product && typeof item.product.priceAfterDiscount === 'number') {
                return acc + (item.quantity * item.product.priceAfterDiscount);
            }
            return acc;
        }, 0);

        const totalAmount = cart.totalPrice + shippingCost

        res.render('user/shoppingCart',{cart, shipping:shippingCost, totalAmount:totalAmount})
    } catch (error) {
        console.error(error);
        res.status(500).json({ success:false, message: 'Error fetching cart.' });
        
    }
}

//adding a product to cart
exports.addToCart = async (req, res) => {
    

    try { 
        const { productId, quantity } = req.body;
        const userId = req.session.user.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Check if quantity is a valid number
        const parsedQuantity = parseInt(quantity, 10);
        if (isNaN(parsedQuantity) || parsedQuantity < 1) {
            return res.status(400).json({ success: false, message: 'Invalid quantity' });
        }
        
        // Check if the product exists and has enough stock
        const product = await Products.findById(productId);
       
        if (!product) {
            return res.status(400).json({ success: false, message: 'Product not found' });
        }
        
        if (product.stock < parsedQuantity) {
            return res.status(400).json({ success: false, message: 'Insufficient stock available' });
        }

       
        // Find or create cart for the user
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] ,totalPrice: 0 });
        }

        // Check if the item already exists in the cart
        const existingItem = cart.items.find(item => item.product.toString() === productId);
        if (existingItem) {
            
            const newQuantity = existingItem.quantity += parsedQuantity;
            if(newQuantity > product.stock){
                return res.status(400).json({ success:false, message:`Only ${product.stock} units available in stock or already added the maximum stock in your cart` })
            }
            if(newQuantity > 10){
                return res.status(400).json({ success: false, message: 'Maximum 10 quantity or maximum quantity already added to your cart'})
            }

           
            existingItem.quantity = newQuantity
        } else {
          
            cart.items.push({ product: productId, quantity: parsedQuantity });
        }

        
        cart.totalPrice = cart.items.reduce((acc, item) => {
            if (item.product && item.quantity && product.priceAfterDiscount) {
                return acc + (item.quantity * product.priceAfterDiscount);
            }
            return acc;
        }, 0);

    
        await cart.save();
        res.status(200).json({ success: true, message: 'Product added to cart successfully' });

        
    } catch (error) {
        console.error('Error adding to cart:', error.message,error.stack);
        res.status(500).json({ success: false, message: 'Error adding product to cart' });
    }
};


// Update Cart Item
exports.updateCartItem = async (req, res) => {
    const { productId } = req.params;
    const { change } = req.body;  

    try {
        const userId = req.session.user.id;
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        const product = await Products.findById(productId)

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        
        // Find the item in the cart and update its quantity
        const cartItem = cart.items.find(item => item.product._id.toString() === productId);

        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }

        

        // calculate the new quantity
        const newQuantity = cartItem.quantity += change;

       
        if(newQuantity > product.stock ){
            return res.status(400).json({ success:false, message: `Only ${product.stock} kg units available in stock`})
        }else if(newQuantity > 10){
            return res.status(400).json({ success:false, message: 'Maximum 10 kg allowed'})

        }

        //update the quantity
        cartItem.quantity = newQuantity;

        // Ensure the quantity is not less than 1
        if (cartItem.quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity cannot be less than 1' });
        }
        
        cart.totalPrice = cart.items.reduce((acc, item) => {
            if (item.product && typeof item.product.priceAfterDiscount === 'number') {
                return acc + (item.quantity * item.product.priceAfterDiscount);
            }
            return acc; 
        }, 0);        
        
        
        // Save the updated cart
        await cart.save();

        // Respond with the updated cart item details
        const updatedPrice = (cartItem.quantity * cartItem.product.priceAfterDiscount).toFixed(2);
        res.json({
            success: true,
            updatedQuantity: cartItem.quantity,
            updatedPrice: updatedPrice,
            totalPrice: cart.totalPrice.toFixed(2),
        });

    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ success: false, message: 'Error updating cart item' });
    }
};

// Remove Cart Item
exports.removeCartItem = async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.user.id;
    
    try {
        const cart = await Cart.findOne({ user: userId }).populate('items.product'); 
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Filter out the item
        cart.items = cart.items.filter(item => item.product._id.toString() !== productId);
        cart.markModified('items')
        cart.totalPrice = cart.items.reduce((acc, item) => acc + (item.quantity * item.product.priceAfterDiscount), 0);

       
        await cart.save();

        res.status(200).json({
            success: true,
            updatedCart: cart,
            totalPrice: cart.totalPrice.toFixed(2)
        });
    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).json({ success: false, message: 'Error removing item from cart', error });
    }
};

//checkout stock checking
exports.checkStock = async (req, res) => {
    try {
        const product = await Products.findById(req.params.productId).populate({
            path: 'category',
            select: 'isDeleted name',
        }).exec();

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if the product is deleted or its category is deleted
        if (product.isDeleted || (product.category && product.category.isDeleted)) {
            return res.status(403).json({
                success: false,
                product: {
                    name: product.name,
                    isDeleted: true,
                },
                message: 'This product is blocked or belongs to a blocked category.',
            });
        }

        res.json({
            success: true,
            product: {
                stock: product.stock,
                name: product.name,
                isDeleted: false,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

//check the cart count
exports.getCartCount = async (req,res) =>{
    try {
        const userId = req.session.user?.id
        if(!userId) return res.json({ cartCount: 0})
        
        const cart = await Cart.findOne({ user: userId})
        const cartCount = cart ? cart.items.length : 0

        res.json({ cartCount })
    } catch (error) {
        console.log('Error fetching cart count:',error);
        res.status(500).json({ cartCount: 0})
        
    }
}




//CHECKOUT

//show checkout page
exports.showCheckOut = async(req,res)=>{
  

    try {
        const userId = req.session.user.id;

        if(!userId){
            return res.redirect('/login')
        }

        const cart = await Cart.findOne({user: userId}).populate('items.product');
        const addresses = await Address.find({user: userId})

        if(!cart || cart.items.length === 0 ){
            return res.redirect('/cart'); 
        }

        
        //calculations
        const total = cart.items.reduce((acc, item) => acc + (item.quantity * item.product.priceAfterDiscount), 0);
         
        const shipping = 50
        const appliedDiscount =  0
        const totalPriceAfterDiscount = total + shipping - appliedDiscount;

        //find the default address 
        const defaultAddress = addresses.find(address => address.isDefault)
        const coupons = await Coupons.find({})


        

        res.render('user/checkoutPage', { 
            user: userId, 
            addresses,
            defaultAddress, 
            cart, 
            coupons,
            totalPriceAfterDiscount: totalPriceAfterDiscount.toFixed(2), 
            shipping:shipping.toFixed(2),
            discountAmount: appliedDiscount.toFixed(2), 
            total: total.toFixed(2),
            
        });
        
    } catch (error) {
        console.log('Error displaying checkout:', error.message)
        res.status(500).json({success: false, message: 'Error fetching checkout details'})        
    }
}

//apply coupon
exports.applyCoupon = async(req,res)=>{
    try {
        const { couponCode } = req.body;
        const userId = req.session.user.id  
        
     
        const coupon = await Coupons.findOne({ couponCode, isActive: true });
        
   
        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or inactive coupon' });
        }

       
        if (new Date() > coupon.expDate) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

      
        if (coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const totalPrice = cart.items.reduce((acc, item) => {
            return acc + (item.quantity * Number(item.product.priceAfterDiscount));
        }, 0);
       

        const discountAmount = (totalPrice * Number(coupon.discount)) / 100;
        const shipping = 50
        const totalPriceAfterDiscount = totalPrice + shipping - discountAmount ;
        
        //update the cart with coupon code
        cart.couponCode = couponCode
        cart.discount = discountAmount
        
        await cart.save()
        

        res.json({ 
            success:true,
            message: 'Coupon applied successfully',
            cart,
            totalPrice,
            shipping,
            discountAmount,
            totalPriceAfterDiscount
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success:false, message: 'Something went wrong' });
    }
}

// //remove coupon 
exports.removeCoupon = async(req,res)=>{
    try {
        
        const userId = req.session.user.id
        const cart = await Cart.findOne({ user:userId }).populate('items.product')

        if(!cart){
            return res.status(404).json({ success:false, message: 'Cart not found'})
        }

        //remove the coupon 
        cart.couponCode = null
        cart.discount = 0

    

        const shipping = 50
        const totalPrice = cart.items.reduce((acc, item) => {
            return acc + (item.quantity * Number(item.product.priceAfterDiscount));
        }, 0);
        await cart.save()
        
        res.status(200).json({ success:true, message: 'Coupon removed successfully', totalPrice: totalPrice + shipping})
    } catch (error) {
        
        console.error(error);
        res.status(500).json({ success:false, message: 'Something went wrong' });
    }
}
 
//order create and clear cart
exports.createOrder = async(req,res)=>{
    

    try {

        let { shippingAddress, paymentMethod, couponCode } = req.body
        const userId = req.session.user.id

        console.log(couponCode, paymentMethod,shippingAddress )

        if(!userId){
            return res.status(401).json({ success: false, message: 'User not authenticated'})
        }

        if(typeof shippingAddress === 'string'){
            const address = await Address.findById(shippingAddress)
            if(!address){
                return res.status(400).json({ success:false, message:'Invalid shipping address'})

            }

            shippingAddress = {
                firstName: address.firstName,
                lastName: address.lastName,
                mobile: address.mobile,
                street: address.street,
                city: address.city,
                state: address.state,
                zipcode: address.zipcode,
                country: address.country
            }
        }


        const cart = await Cart.findOne({ user: userId }).populate('items.product')
        if(!cart || cart.items.length === 0){
            return res.status(400).json({ success: false, message: 'Cart is empty'})
        }

        const unlistedProducts = cart.items.filter(item => item.product.isDeleted)
        if(unlistedProducts.length > 0){
            const unlistedProductName = unlistedProducts.map(item => item.product.name)
            return res.status(400).json({
                success: false,
                message: `The following products are no longer available: ${unlistedProductName.join(', ')}`,
            })
        }

        // Calculate the total price
         const totalPrice = cart.items.reduce((acc, item) => {
            return acc + (item.quantity * item.product.priceAfterDiscount);
        }, 0);
       
        const shipping = 50
        let totalPriceAfterDiscount = totalPrice + shipping;
        let couponApplied = false
        let discountAmount = 0
        if(couponCode){
            const coupon = await Coupons.findOne({ couponCode })
            console.log(coupon)
            if(coupon){
                const percentageDiscount = (totalPrice * coupon.discount)/100
                discountAmount = percentageDiscount
                totalPriceAfterDiscount = totalPrice + shipping - discountAmount

                //update coupon 
                coupon.usedCount += 1
                await coupon.save()
                couponApplied = true
            }  else {
                return res.status(400).json({ success: false, message: 'Invalid or inactive coupon'})
            }
    
          
        }

        if(paymentMethod === 'Wallet'){
            const wallet = await Wallet.findOne({ user: userId})
            if(!wallet) return res.status(400).json({ success: false, message:'Wallet not found'})
            if(wallet.balance < totalPriceAfterDiscount) return res.status(400).json({ success:false, message:'Insufficient Balance'})

            const order = new Order({
                user: userId,
                items: cart.items.map(item =>({
                    product: item.product._id,
                    quantity: item.quantity,
                    price: item.product.priceAfterDiscount,
                })),
                totalPrice,
                totalPriceAfterDiscount,
                discountAmount,
                shippingAddress,
                paymentMethod,
                shipping,
                couponCode: couponApplied ? couponCode : null,
                status: 'paid'
            })
            await order.save()

            for(const item of cart.items){
                const product = item.product
                product.stock -= item.quantity
                await product.save()
            }

            wallet.balance -= totalPriceAfterDiscount
            wallet.transcationHistory.push({
                status: 'debit',
                amount: totalPriceAfterDiscount,
                description: `Order Purchased Id:${order._id}`,
                createdAt: Date.now()
            })
            await wallet.save()

            cart.items = []
            cart.totalPrice = 0
            await cart.save()

            return res.status(200).json({ success:true, message:'Order placed successfully',orderId: order._id})
            
        } else if(paymentMethod === 'Online-payment'){

            const razorpayOrder = await razorpay.orders.create({
                amount: parseInt(totalPriceAfterDiscount) * 100, 
                currency: 'INR',
                receipt: `receipt_order_${new Date().getTime()}`
            }).catch((err) => {
                console.error("Error creating Razorpay order:", err);
                return res.status(500).json({ success: false, message: 'Error creating Razorpay order' });
            });
            console.log(razorpayOrder)

            //save pending order with Razorpay order ID
            const order = new Order({
                user: userId,
                items: cart.items.map(item =>({
                    product: item.product._id,
                    quantity: item.quantity,
                    price: item.product.priceAfterDiscount

                })),
                totalPrice,
                discountAmount,
                totalPriceAfterDiscount,
                shippingAddress,
                paymentMethod,
                shipping,
                couponCode: couponApplied ? couponCode : null,
                status: 'pending',
                razorpayOrderId: razorpayOrder.id
            })
            await order.save()
            //Update product stock
            for(const item of cart.items){
                const product = item.product;
                product.stock -= item.quantity;
                await product.save() 
            }

            // Clear cart
            cart.items = [];
            cart.totalPrice = 0;
            await cart.save()

            return res.status(200).json({
                success: true,
                message: 'Razorpay order created successfully',
                user: userId,
                orderId: order._id,
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID
            })

        } else {
            const order = new Order({
                user:userId,
                items: cart.items.map(item =>({
                    product: item.product._id,
                    quantity: item.quantity,
                    price: item.product.priceAfterDiscount
                })),
                totalPrice,
                discountAmount,
                totalPriceAfterDiscount,
                shippingAddress,
                shipping,
                paymentMethod,
                status: 'pending',
                couponCode: couponApplied ? couponCode : null
                

            })
            await order.save()

            //Update product stock
            for(const item of cart.items){
                const product = item.product;
                product.stock -= item.quantity;
                await product.save() 
            }

            // Clear cart
            cart.items = [];
            cart.totalPrice = 0;
            await cart.save()

            res.status(200).json({ success: true, message: 'Order placed successfully', orderId: order._id})

        }
        

       
    } catch (error) {
        console.error('Error creating order:', error.message);
        res.status(500).json({ success: false, message: 'Error placing order' });
        
    }
}

//verify payment
exports.verifyPayment = async(req,res)=>{

    try {
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

      
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        
        if (generatedSignature === razorpaySignature) {
           
            const order = await Order.findOneAndUpdate(
                { razorpayOrderId: razorpayOrderId },
                { 
                    paymentStatus: 'paid', 
                    razorpayPaymentId: razorpayPaymentId, 
                    status: 'paid' 
                },
                { new: true }
            );

            if (!order) {
              
                return res.status(200).json({ 
                    success: false, 
                    message: 'Payment verified but order not found' 
                });
            }

           
            return res.status(200).json({ 
                success: true, 
                message: 'Payment verified and order updated', 
                orderId: order._id 
            });
        } else {
            
            await Order.findOneAndUpdate(
                { razorpayOrderId: razorpayOrderId },
                { 
                    paymentStatus: 'failed', 
                    razorpayPaymentId:razorpayPaymentId,
                    status: 'pending' 
                },
                { new : true }
            );

            return res.status(400).json({ 
                success: false, 
                message: 'Payment verification failed. Signature mismatch.' 
            });
        }
    } catch (error) {
       
        console.error('Error verifying payment:', error);

        res.status(500).json({
            success: false,
            message: 'An error occurred while verifying the payment. Please try again.',
        });
    }

    
}

//retry payment
exports.retryPayment = async(req,res)=>{
    try {
        const { orderId } = req.params

        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(404).json({
              success: false,
              message: 'Order not found. Please check the order ID.',
            });
          }
      
          if (order.paymentStatus !== 'pending') {
            return res.status(400).json({
              success: false,
              message: `Order payment status is not pending. Current status: ${order.paymentStatus}`,
            });
          }

        const razorpayOrder = await razorpay.orders.create({
            amount:parseInt( order.totalPriceAfterDiscount) * 100,
            currency: 'INR',
            receipt:`order_${order._id}`,

        })

        order.razorpayOrderId = razorpayOrder.id
        await order.save()

        res.status(200).json({
            success:true,
            message:'New payment initiated',
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            razorpayOrderId: razorpayOrder.id

        })
    } catch (error) {
        console.log('error retrying payment:',error)
        res.status(500).json({
            success: false,
            message:"An error occurred while retrying payment. please try again"
        })
    }
}

//add address in checkout page
exports.CheckOutAddAddress = async (req, res) => {

    try {
        const { firstName, lastName, mobile, street, city, state, zipcode, country, isDefault } = req.body;
        const userId = req.session.user.id;
    
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const newAddress = new Address({
            user: userId,
            firstName,
            lastName,
            mobile,
            street,
            city,
            state,
            zipcode,
            country,
            isDefault,
        });

        await newAddress.save();
        res.status(200).json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.error('Error adding address:', error.message);
        res.status(500).json({ success: false, message: 'Error adding address' });
    }
};

//order confirmation
exports.orderConfirmation = async(req,res)=>{
    const {orderId} = req.params;
    try {
        const order = await Order.findById(orderId).populate('items.product').populate('shippingAddress')
        if(!order){
            return res.status(400).json({success:false, message:'No order found'})
        }
        res.render('user/orderConfirmation',{ order })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message: 'Error in order confirmation page'})
    }
}

//logout
exports.logout = (req,res) => {
    req.session.destroy(err =>{
     if(err){
        console.log("error", err)
         return res.redirect('/') 
     }
     res.clearCookie('connect.sid') 
     res.redirect('/login')
    })
 }
 
