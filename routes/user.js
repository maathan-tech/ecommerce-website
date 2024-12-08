const express = require('express');
const router = express.Router();
const userController = require('../controller/user');
const authMiddleware = require('../middlewares/authMiddlewares'); // Ensure this points to the correct path
const passport = require('passport');
const User = require('../models/user')
const authenticateUser = require('../middlewares/authenticateUser')

// Signup
router.get('/signup', authMiddleware.preventAccessForLoggedUsers, userController.showSignup);
router.post('/signup', authMiddleware.preventAccessForLoggedUsers, userController.signup);

// OTP Verification
router.get('/verify-otp', authMiddleware.preventAccessForLoggedUsers, userController.showOtp);
router.post('/verify-otp', authMiddleware.preventAccessForLoggedUsers, userController.verifyOtp);
router.post('/resend-otp', authMiddleware.preventAccessForLoggedUsers, userController.resendOtp);

//forgotpassword
router.get('/forgot-password',authMiddleware.preventAccessForLoggedUsers,userController.showForgotpassword)
router.post('/forgot-password',authMiddleware.preventAccessForLoggedUsers,userController.requestPasswordReset)

router.get('/reset-password/:token',authMiddleware.preventAccessForLoggedUsers,userController.showResetPassword)
router.post('/reset-password/:token',authMiddleware.preventAccessForLoggedUsers,userController.resetPassword)


// Login
router.get('/login', authMiddleware.preventAccessForLoggedUsers, userController.showLogin);
router.post('/login', authMiddleware.preventAccessForLoggedUsers, userController.login);

// Google Login
router.get('/auth/google', authMiddleware.preventAccessForLoggedUsers, (req, res, next) => {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google Callback
router.get(
    '/auth/google/callback',authMiddleware.preventAccessForLoggedUsers,
    passport.authenticate('google', { failureRedirect: '/login' }),
    async(req, res) => {
        try {
         
            const userEmail = req.user.email;

            const user = await User.findOne({ email: userEmail})
            if(user.isBlocked){
                req.logout((err) => {
                    if (err) {
                        console.error('Logout error:', err);
                        return res.status(500).json({ success: false, message: 'Logout failed' });
                    }
            })
                return res.redirect('/login?error=Your account is blocked. Please contact support.')
            }
            
            req.session.user = { id: user._id, role: 'user' }; 
        res.redirect('/'); 
        } catch (error) {
            console.log(error);
            res.redirect('/login?error=Login failed. Please try again.')
            
        }


        
    }
);

// Protected Routes
router.get('/',userController.showHome);

//display all products
router.get('/allProducts',userController.allProducts)
//display productDetails
router.get('/productDetails/:id',userController.showProductDetails)

//display user dashboard
router.get('/userDashboard',authMiddleware.isUserLogged,userController.showUserdashboard)

//display orders
router.get('/orders',authMiddleware.isUserLogged,userController.showOrderdetails)
//display order details
router.get('/orders/orderDetails/:orderId',authMiddleware.isUserLogged,userController.getOrderDetails)
router.post('/orders/orderDetails/:orderId/cancel',authMiddleware.isUserLogged,userController.cancelOrder)
//return order
router.post('/orders/orderDetails/:orderId/return',authMiddleware.isUserLogged,userController.returnOrder)
//download invoice
router.get('/orders/:orderId/download-invoice',authMiddleware.isUserLogged,userController.getInvoice)

//display user addressbook
router.get('/addressbook',authMiddleware.isUserLogged,userController.showAddressbook)
//add new address
router.post('/addressbook/add',authMiddleware.isUserLogged,userController.addAddress)
//set default address
router.post('/addressbook/:id/default',authMiddleware.isUserLogged,userController.setDefaultAddress)
//display edit address
router.get('/addressbook/:id/edit',authMiddleware.isUserLogged,userController.getEditAddress)
//edit address
router.post('/addressbook/:id/edit',authMiddleware.isUserLogged,userController.editAddress)
//delete address
router.post('/addressbook/:id/delete',authMiddleware.isUserLogged,userController.deleteAddress)

//display wishlist
router.get('/wishlist',authMiddleware.isUserLogged,userController.getWishlist)
//wishlist count
router.get('/wishlist/count',userController.getWishlistCount)
//add to wishlist
router.post('/wishlist/add',authMiddleware.isUserLogged,userController.addToWishlist)
//remove from wishlist
router.post('/wishlist/remove',authMiddleware.isUserLogged,userController.removeFromWishlist)
//add to cart from wishlist
router.post('/wishlist/addToCart',authMiddleware.isUserLogged,userController.addToCartFromWishlist)

//display shopping cart
router.get('/shoppingCart',authMiddleware.isUserLogged,userController.showShoppingCart)

//display user profile
router.get('/profile',authMiddleware.isUserLogged,userController.showProfile)
//update user profile
router.post('/profile',authMiddleware.isUserLogged,userController.updateProfile)
//upload user profile image
router.post('/uploadProfileImage',authMiddleware.isUserLogged,userController.uploadProfileImage)
//change password
router.post('/changePassword',authMiddleware.isUserLogged,userController.changePassword)
//wallet
router.get('/wallet',authMiddleware.isUserLogged,userController.showWallet)



//add product to cart
router.post('/add',authMiddleware.isUserLogged,userController.addToCart)
//get cart
router.get('/cart',authMiddleware.isUserLogged,userController.showShoppingCart)
//get cart count
router.get('/cart/count',userController.getCartCount)
//update cart
router.post('/update/:productId',authMiddleware.isUserLogged,userController.updateCartItem)
//remove item from cart
router.post('/remove',authMiddleware.isUserLogged,userController.removeCartItem)
//check stock status while proceed to checkout
router.get('/product-stock/:productId',authMiddleware.isUserLogged,userController.checkStock)

//apply coupon
router.post('/apply-coupon',authMiddleware.isUserLogged,userController.applyCoupon)
router.post('/remove-coupon',authMiddleware.isUserLogged,userController.removeCoupon)

//display checkout
router.get('/checkout',authMiddleware.isUserLogged,userController.showCheckOut)
router.post('/checkout/create-order',authMiddleware.isUserLogged,userController.createOrder)
//check out add address
router.post('/checkout/addresses',authMiddleware.isUserLogged,userController.CheckOutAddAddress)
//verify payment
router.post('/checkout/verify-payment',authMiddleware.isUserLogged,userController.verifyPayment)
//retry payment
router.get('/checkout/retry-payment/:orderId',authMiddleware.isUserLogged,userController.retryPayment)
//order confirmation
router.get('/orderConfirmation/:orderId',authMiddleware.isUserLogged,userController.orderConfirmation)
//User Logout
router.get('/logout', authMiddleware.isUserLogged, userController.logout);

module.exports = router;
