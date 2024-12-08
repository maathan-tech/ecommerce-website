const express = require('express')
const router = express.Router()
const adminController = require('../controller/admin')
const authMiddleware = require('../middlewares/authMiddlewares')
const upload = require('../config/multerConfig')
const Offer = require('../models/offer')

router.get('/login',authMiddleware.preventAccessForLoggedUsers,adminController.getlogin)
router.post('/login',adminController.postlogin)

router.get('/dashboard',authMiddleware.isAdminLogged,adminController.getDashboard)
router.get('/sales-report',authMiddleware.isAdminLogged,adminController.getSalesReport)
router.get('/sales-report/export/excel',authMiddleware.isAdminLogged, adminController.exportToExcel);
router.get('/sales-report/export/pdf',authMiddleware.isAdminLogged, adminController.exportToPDF);

router.get('/orders',authMiddleware.isAdminLogged,adminController.getOrders)
// Update order status
router.post('/order/:orderId/status',authMiddleware.isAdminLogged, adminController.updateOrderStatus); 
//return status
router.post('/order/:orderId/return',authMiddleware.isAdminLogged,adminController.updateReturnStatus)
//get order details
router.get('/order/:orderId',authMiddleware.isAdminLogged,adminController.getOrderDetails)


//display user management page
router.get('/usermanagement',authMiddleware.isAdminLogged,adminController.getUser)
//search user
router.get('/usermanagement/search',authMiddleware.isAdminLogged,adminController.searchUsers)
//block or unblock user
router.post('/usermanagement/block/:id',adminController.blockUser)
router.post('/usermanagement/unblock/:id',adminController.unblockUser)

//list categories
router.get('/productcategories',authMiddleware.isAdminLogged,adminController.listProductCategories)

//display add category
router.get('/productcategories/addcategories',authMiddleware.isAdminLogged,adminController.getAddCategory)
//handle add category
router.post('/productcategories/addcategories',authMiddleware.isAdminLogged,upload.singleCatImage,adminController.createCategory)


//display edit categories
router.get('/productcategories/:categoryId/editcategories',authMiddleware.isAdminLogged,adminController.getEditCategory)
//handle edit categories
router.post('/productcategories/:categoryId/editcategories',authMiddleware.isAdminLogged,upload.singleCatImage,adminController.editcategories)
//soft delete category
router.post('/productcategories/:categoryId/delete',authMiddleware.isAdminLogged,adminController.softDeleteCategory)
//display products on base of category
router.get('/productcategories/:categoryId/products',authMiddleware.isAdminLogged,adminController.getProducts)

//search for product
router.get('/products/search',authMiddleware.isAdminLogged,adminController.searchProducts)
//display add product
router.get('/products/addproduct',authMiddleware.isAdminLogged,adminController.getAddProduct)
router.post('/products/addproduct',authMiddleware.isAdminLogged,upload.multipleUpload,adminController.addProducts)

//edit products
router.get('/products/:productId/edit',authMiddleware.isAdminLogged,adminController.getEditProduct)
router.post('/products/:productId/edit',authMiddleware.isAdminLogged,upload.multipleUpload,adminController.editProduct)
router.post('/products/remove-image', adminController.removeImage);

//list or unlist the product
router.post('/products/:productId/toggle-delete',authMiddleware.isAdminLogged,adminController.toggleSoftDelete)
//list products
router.get('/products',authMiddleware.isAdminLogged,adminController.listProducts)
//list coupons
router.get('/coupons',authMiddleware.isAdminLogged,adminController.listCoupons)
//add coupons
router.post('/coupons/add',authMiddleware.isAdminLogged,adminController.addCoupon)
router.post('/coupons/edit',authMiddleware.isAdminLogged,adminController.editCoupon)
router.delete('/coupons/delete',authMiddleware.isAdminLogged,adminController.deleteCoupon)

//offers
router.get('/offers',authMiddleware.isAdminLogged,adminController.listOffers)
//add offers
router.post('/offers/add',authMiddleware.isAdminLogged,adminController.addOffer)
//edit offers
router.post('/offers/edit',authMiddleware.isAdminLogged,adminController.editOffer)
//delete offer
router.delete('/offers/delete/:offerId',authMiddleware.isAdminLogged,adminController.deleteOffer)


router.get('/offer', async (req, res) => {
    try {
        const offers = await Offer.find({ type: 'category', isActive: true });
        res.json(offers); 
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

router.post('/applyOfferToCategory',authMiddleware.isAdminLogged,adminController.applyOffertoCategory)
router.post('/applyOfferToProducts',authMiddleware.isAdminLogged, adminController.applyOffertoProducts)
//logout
router.get('/logout',authMiddleware.isAdminLogged,adminController.logout)



module.exports = router
