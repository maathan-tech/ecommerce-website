const User = require('../models/user')
const bcrypt = require('bcryptjs')
const Category = require('../models/category')
const Product = require('../models/products')
const multer = require('multer')
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const Order = require('../models/orders')
const mongoose = require('mongoose')
const Wallet = require('../models/wallet')
const Coupons = require('../models/coupons')
const Offers = require('../models/offer')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const { match } = require('assert')
const moment = require('moment')
const offer = require('../models/offer')
const { deflate } = require('zlib')


//Show Admin page
exports.getlogin = async(req,res) => {
    try {
        if(req.session.admin){
            return res.redirect('/admin/dashboard')
        }
        res.render('admin/login')
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in admin loginpage'})
        
    }
}



//handle login
exports.postlogin = async (req,res) => {
    try {
        const { username, password } = req.body;
        if(username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD){
            req.session.user = {username, role: 'admin' }
            res.status(200).json({ success:true, message:'Login successfully'})
        }else{
            res.status(400).json({ success:false, message:'Invalid credentials'})
        }
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in admin Login'})
    }
}

//Show admin dashboard
exports.getDashboard = (req,res) => {
    try {
        res.render('admin/dashboard')
       
    } catch (error) {
      res.status(500).json({success:false, message:'Error in geting dashboard'})
    }
}

//show getOrders
exports.getOrders = async (req, res) => {
    try {
        const { status, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

        let filter = {};

        if (status) {
            filter.status = status;
        }

        
        if (minPrice || maxPrice) {
            filter.totalPrice = {};
            if (minPrice) filter.totalPrice.$gte = parseFloat(minPrice);
            if (maxPrice) filter.totalPrice.$lte = parseFloat(maxPrice);
        }

        let sortOptions = {};
        const sort = req.query.sort || 'date-desc';
        if (sort === 'date-desc') sortOptions.createdAt = -1;
        else if (sort === 'date-asc') sortOptions.createdAt = 1;
        else if (sort === 'price-high') sortOptions.totalPrice = -1;
        else if (sort === 'price-low') sortOptions.totalPrice = 1;

        sortOptions.returnStatus = -1
        
        const pageNumber = parseInt(page, 10);
        const pageLimit = parseInt(limit, 10);

        const orders = await Order.find(filter)
            .populate('user', 'firstName lastName email') 
            .populate('items.product', 'name price') 
            .populate('shippingAddress')
            .sort(sortOptions) 
            .skip((pageNumber - 1) * pageLimit) 
            .limit(pageLimit); 

 
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / pageLimit);

        res.render('admin/orders', {
            orders,
            currentPage: pageNumber,
            totalPages,
            totalOrders,
            pageLimit
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success:false, message:'Error in fetching orders'});
    }
};


//update the user order
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;  
        const { status } = req.body;  

        const allowedStatuses = ['pending', 'paid', 'shipped', 'Delivered', 'Cancelled'];
        
        if (!allowedStatuses.includes(status)) {
            return res.json({ success: false, message: "Invalid status" });
        }

        const order = await Order.findById(orderId).populate('items.product');
        if (!order) return res.json({ success: false, message: "Order not found" });

        // Restrict changes to 'Delivered' and 'Cancelled' orders
        if (order.status === 'Delivered' || order.status === 'Cancelled' || order.status === 'Returned') {
            return res.json({ success: false, message: "Cannot change the status of a delivered and returned or cancelled order" });
        }

        if(order.status === 'pending' && order.paymentStatus === 'pending' && status !== 'Cancelled' && order.paymentMethod === 'Online-payment'){
            return res.json({ success:false, message:'Payment is pending for this order'})
        }

        // Restrict backwards status changes
        if ((order.status === 'paid' && status === 'pending') ||
            (order.status === 'shipped' && status !== 'Delivered')) {
            return res.json({ success: false, message: "Cannot go back to previous stages" });
        }

        // Restore stock if order is canceled
        if (status === 'Cancelled') {
            await Promise.all(order.items.map(async (item) => {
                const product = item.product;
                product.stock += item.quantity;
                await product.save();
            }));
        

            //refund amount
            if(order.paymentStatus === 'paid' || order.paymentMethod === 'Wallet'){
                const wallet = await Wallet.findOne({ user: order.user._id})
                if(!wallet){
                    return res.json({ success:false, message:"user wallet not found"})
                }

                const refundAmount = order.totalPriceAfterDiscount
                wallet.balance += refundAmount

                wallet.transcationHistory.push({
                    status:'credit',
                    amount: refundAmount,
                    description: `Refund for cancelled order ${orderId}`,
                    createdAt: Date.now()
                })
                await wallet.save()
            }
        }

        order.status = status;
        await order.save();

        return res.json({ success: true, message: "Order status updated successfully!" });

    } catch (error) {
        console.error(error);
        return res.json({ success: false, message: "Error updating order status" });
    }
};


// Get the order details
exports.getOrderDetails = async(req,res)=>{
   
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send('Invalid order ID');
        }
        
        const order = await Order.findById(orderId).populate('items.product','name price images').populate('user','name email').populate('shippingAddress');
        if (!order) {
          return res.status(400).json({ success:false, message:'Order not found'})
          }

        //Calculate total order amount
        const totalAmount = order.items.reduce((total, item) => total + (item.price * item.quantity), 0);

        res.render('admin/orderDetails',{ order, totalAmount })
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ success:false, message:'Error occured while order details fetching'})
    }

}

exports.updateReturnStatus = async(req,res)=>{
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const allowedStatuses = ['not-request','pending','approved','rejected']
        if(!allowedStatuses){
            res.status(400).json({success:false, message:'invalid status'})
        }

        const order = await Order.findById(orderId).populate('items.product')
        if(!order){
            res.status(400).json({ success: false, message:'No order found'})
        }
        if(status === 'approved'){
            order.returnStatus = status
            order.status = 'Returned'
          

            //update stock
            for(const item of order.items){
                if(item.product){
                    const product = item.product
                    product.stock += item.quantity
                    await product.save()
                }
            }
            await order.save()

            const wallet = await Wallet.findOne({user: order.user})
            if(wallet){
                const creditAmount = order.totalPriceAfterDiscount
                wallet.balance += creditAmount
                wallet.transcationHistory.push({
                    status: 'credit',
                    amount: creditAmount,
                    description: `Returned product ${orderId} `,
                    createdAt: Date.now()
                })
                await wallet.save()
            }
        }else if(status === 'rejected'){
            order.returnStatus = status
            await order.save()
        }
        res.status(200).json({ success: true, message:'status updated successfully'})
        

    } catch (error) {
        console.log(error);
        res.status(500).json({success:false , message: 'error in update return status'})
        
    }
}

//Show usermanagement
exports.getUser = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit; 

        const users = await User.find().skip(skip).limit(limit).sort({ createdAt: -1}); 
        const totalUsers = await User.countDocuments(); 
        const totalPages = Math.ceil(totalUsers / limit); 

        res.render('admin/usermanagement', { users, currentPage: page, totalPages });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success:false, message:'Error occur while userdetails display'})
    }
};

//search user
exports.searchUsers = async (req, res) => {
    try {
        const searchTerm = req.query.q; 
        const users = await User.find({
            $or: [
                { firstName: { $regex: searchTerm, $options: 'i' } }, 
                { lastName: { $regex: searchTerm, $options: 'i' } },  
                { email: { $regex: searchTerm, $options: 'i' } }      
            ]
        });

        const currentPage = 1;
        const totalPages = 1

        res.render('admin/usermanagement', { users,currentPage,totalPages }); 
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ success:false, message:'Error occur while searching user'})
    }
};


//blockuser
exports.blockUser = async(req,res)=>{
    try {
        const userId = req.params.id;
        await User.findByIdAndUpdate(userId,{isBlocked:true})
        res.redirect('/admin/usermanagement')
    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message:'error in blocking the user'})
        
    }
}

//unblock user
exports.unblockUser = async(req,res)=>{
    try {
        const userId = req.params.id;
        await User.findByIdAndUpdate(userId, {isBlocked:false})
        res.redirect('/admin/usermanagement')
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success:false, message:'Error in unblocking the user'})
        
    }
}

//list product categories
exports.listProductCategories = async(req,res)=>{
    try {
        const categories = await Category.find().sort({ createdAt: -1})
        const offers = await Offers.find({ type: 'category'})

        res.render('admin/productcategories',{ categories,offers })
    
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success:false, message:'Error occur while categories listing..'})
    }
}
//display add category
exports.getAddCategory = async(req,res)=>{
    try {
        res.render('admin/addCategory',{ category : null})
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success:false, message:'Error occured while editing page display'})
        
    }
}

//add category
exports.createCategory = async(req,res)=>{
    const { name } = req.body
    
    
    try {

        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } })
        if(existingCategory){
            return res.status(400).json({ success:false, message:'Category already exists'})
        }

        let image = null;
        if (req.file) {
            image = `/uploads/${req.file.filename}`; 
        }

        const category = new Category({
            name: name.trim(),
            image
        });
        
        await category.save()
        res.status(200).json({ success:true, message:'New category added successfully'})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'Error in creating category'})
    }
}

//display edit catergory
exports.getEditCategory = async(req,res)=>{
    const {categoryId } = req.params;
    try {
        const category = await Category.findById(categoryId);

        if(!category){
            return res.status(404).send('category not found');
        }
        res.render('admin/editcategories',{category})
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success:false, message:'Category edit occurs error'})
        
    }
}

//edit categories
exports.editcategories = async (req, res) => {
    const { categoryId } = req.params;
    const { name } = req.body;

    try {
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, "i") },
            _id: { $ne: categoryId }
        });

        if (existingCategory) {
            return res.status(400).json({ success:false, message:'Category already exists'})
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(400).json({success:false, message:'Category not found'});
        }

        const updateData = { name:name.trim() };

        if (req.file) {
          
            if (category.image) {
                const oldImagePath = path.join(__dirname, '../public/uploads', category.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (err) => {
                        if (err) {
                            console.error('Error deleting old image:', err.message);
                        } else {
                            console.log('Old image deleted successfully');
                        }
                    });
                } else {
                    console.log('Image file not found:', oldImagePath);
                }
            }

            updateData.image = `/uploads/${req.file.filename}`; 
        }

        await Category.findByIdAndUpdate(categoryId, updateData);
        res.status(200).json({ success:true, message:'Category updated successfully'})

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success:false, message:'Error in updating category'})
    }
};

//soft delete category
exports.softDeleteCategory = async(req,res)=>{
    const {categoryId } = req.params;
    try {
        const category = await Category.findById(categoryId);
        if(!category){
            return res.status(404).send('Category not found')
        }
        category.isDeleted = !category.isDeleted;
        await category.save()
        
        res.redirect('/admin/productcategories')
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ success:false, message:'Error occur in soft Delete'})
    }
}

//Display products on the base of category
exports.getProducts = async(req,res)=>{
   try {
    const { categoryId } = req.params;
    const category = await Category.findById(categoryId)
    const products = await Product.find({category:categoryId})
    res.render('admin/categoryProducts',{category, products})
   } catch (error) {
    console.log(error)
    res.status(500).json({ success:false,message:'Error occur in product based on category'})
   }
}


//search products
exports.searchProducts = async (req, res) => {
    try {
        const { query } = req.query;
        const searchQuery = typeof query === 'string' ? query : '';
        const products = await Product.find({
            name: { $regex: new RegExp(searchQuery, 'i') }
        });

        const offers  =  await Offers.find()
        const currentPage = 1; 
        const totalPages = 1; 

        res.render('admin/products', { products, currentPage, totalPages, offers });
    } catch (error) {
        console.error("Error searching products:", error);
        res.status(500).json({ success:false, message:'Error in searching product'})
    }
};


//display add products
exports.getAddProduct = async (req, res) => {
    try {
        const categories = await Category.find();
        const product = req.params.productId ? await Product.findById(req.params.productId) : null;
        res.render('admin/addProduct', { product, categories });
    } catch (error) {
        console.error("Error fetching add/edit product page:", error.message);
        res.status(500).json({ success:false, message:'Error in adding product'})
    }
};



//image processing helper
 const processImages = async (files) => {
    const processedImages = [];
    for (const file of files) {
        const imagePath = await saveImageToDisk(file);
        processedImages.push(imagePath);
    }
    return processedImages;
};

// Save image to disk and return the path
const saveImageToDisk = (file) => {
    return new Promise((resolve, reject) => {
        const filePath = path.join(__dirname, '../public/uploads/', file.filename);
        fs.rename(file.path, filePath, (err) => {
            if (err) {
                return reject(err);
            }
            resolve(`/uploads/${file.filename}`); 
        });
    });
};

// Add a new product
exports.addProducts = async (req, res) => {
    try {
        const { name, price, description, category, stock } = req.body;
    

        // Check if at least 3 images are provided
        if (!req.files || req.files.length < 3) {
            return res.status(400).json({ success:false, message:'Atleast 3 images required'})        }

        const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
        if (existingProduct) {
            return res.status(400).json({ success:false, message:'Product already exists'})
        }
        // Process the images
        const images = await processImages(req.files);

        const categoryData = await Category.findById(category)
        if(!categoryData){
            return res.status(400).json({ success:false, message:'Invalid category'})
        }

        let offerDiscount = 0
        let offerApplied = false;
        let offerId = null

        if(categoryData.offerApplied && categoryData.offerId){
            const activeOffer = await Offers.findOne({
                _id:categoryData.offerId,
                isActive:true,
                startDate:{$lte: new Date()},
                endDate: {$gte: new Date()}
            })

            if(activeOffer){
                offerDiscount = activeOffer.discount
                offerApplied = true
                offerId = activeOffer._id
            }
        }

        const product = new Product({ name:name.trim(), price, description:description.trim(), images, category, stock, offerApplied, offerDiscount, offerId });
      
        await product.save();
       
        
        res.status(200).json({ success:true, message:'Product added successfully'})
    } catch (error) {
        console.error("Error adding product:", error.message);
        res.status(500).json({ success:false, message:'Error in adding product'})
    }
};

//display edit product 
exports.getEditProduct = async(req,res)=>{
    const { productId } = req.params
    try {
        const categories = await Category.find()
        const product = await Product.findById(productId)
        if(!product){
            res.status(400).json({success:false, message:'Product not found'})
        }

        res.render('admin/editProduct',{categories,product})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message:'Error in editing product page'})
    }
}



// Edit an existing product
exports.editProduct = async (req, res) => {
    const { productId } = req.params;
    try {
        const product = await Product.findById(productId);
        if (!product) return res.status(404).send("Product not found");

        const { name, price, description, category, stock } = req.body;

        const trimmedName = name.trim()
        const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, "i") }, _id: { $ne: productId }});
        if (existingProduct) {
            return res.status(400).json({ success:false, message:'Product already exists'})
        }

        product.name = name.trim();
        product.price = price;
        product.description = description;
        product.category = category;
        product.stock = stock;

      
        

        // Add new images if any
        if (req.files && req.files.length > 0) {
            const newImages = await processImages(req.files);
            product.images = product.images.concat(newImages);
        }

        const categoryData = await Category.findById(category)

        if(!categoryData){
            return res.status(400).json({ success:false, message:'Invalid category'})
        }

      

        if(categoryData.offerApplied && categoryData.offerId){
            const activeOffer = await Offers.findOne({
                _id:categoryData.offerId,
                type:'category',
                isActive:true,
                startDate:{$lte: new Date()},
                endDate: {$gte: new Date()}
            })

            if(activeOffer){
                product.offerApplied = true
                product.offerDiscount = activeOffer.discount
                product.offerId = activeOffer._id
            }

        }


        await product.save();
       res.status(200).json({ success:true, message:'Product updated successfully'})
    } catch (error) {
        console.error("Error editing product:", error.message);
        res.status(500).json({success:false, message:'Error in updating product'})
    }
};


exports.removeImage = async (req, res) => {
    const { imageUrl, productId } = req.body;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const imageIndex = product.images.indexOf(imageUrl);
        if (imageIndex > -1) {
            product.images.splice(imageIndex, 1);
            await product.save();
        }

        const imagePath = path.join(__dirname,'../public/', imageUrl);
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error('Error removing image from filesystem:', err);
                return res.status(500).json({ success: false, message: 'Error removing image from filesystem' });
            }
            return res.json({ success: true, message: 'Image removed successfully' });
        });

    } catch (error) {
        console.error('Error removing image:', error);
        return res.status(500).json({ success: false, message: 'Error removing image from database and filesystem' });
    }
};


// soft delete of product
exports.toggleSoftDelete = async(req,res)=>{

    const { productId } = req.params;

    try {
        const product = await Product.findById(productId);
        if(!product)   return res.status(404).json({ success:false, message:'product not found'})

        product.isDeleted = !product.isDeleted;
        await product.save()
       res.status(200).json({ success:true })

    } catch (error) {
        console.error(error.message)
        res.status(500).json({ success:false, message:'Error while toggling the softdelete'})
    }
}

// list all products
exports.listProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 8; 
        const skip = (page - 1) * limit; 

        const products = await Product.find().populate('category').skip(skip).limit(limit).sort({ createdAt:-1}); 
        const totalProducts = await Product.countDocuments();

        const totalPages = Math.ceil(totalProducts / limit); 

        const offers = await Offers.find({type: 'product'})

        if (products.length === 0) {
            return res.render('admin/products', { message: 'No products available', currentPage: page, totalPages ,products, offers});
        } else {
            
            return res.render('admin/products', { products, currentPage: page, totalPages, offers });
        }
        
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
}

//coupons
exports.addCoupon = async(req,res)=>{

    try {
        const { couponCode, discount, usageLimit, expDate } = req.body

        if(!couponCode || !discount || !usageLimit || !expDate){
            return res.status(400).json({ success: false, message: 'All fields are required'})
        }

        const trimmedCouponCode = couponCode.trim()
        const existingCoupon = await Coupons.findOne({ couponCode:{ $regex: new RegExp(`^${trimmedCouponCode}$`,"i")}})
        if(existingCoupon){
            return res.status(400).json({ success:false, message:'Coupon code is already exists'})
        }

        const coupon = new Coupons({
            couponCode:trimmedCouponCode,
            discount,
            usageLimit,
            expDate
        })
        
        await coupon.save()
        res.status(200).json({ success: true, message: 'Coupon added successfully'})
        
        
    } catch (error) {
        console.log('Server error:',error);
        res.status(500).json({ success:false, message:'error in adding coupon'})   
    }
}

//list coupons
exports.listCoupons = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

   
        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const totalCoupons = await Coupons.countDocuments();
        const coupons = await Coupons.find()
            .sort({ createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber); 

        const totalPages = Math.ceil(totalCoupons / limitNumber);

        res.status(200).render('admin/coupons', {
            coupons,
            currentPage: pageNumber,
            totalPages,
            totalCoupons,
            limit: limitNumber,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error in listing coupons' });
    }
};

//edit coupon
exports.editCoupon = async(req,res)=>{
    try {
        const { couponId, couponCode, discount, usageLimit, expDate } = req.body
        
        const trimmedCouponCode = couponCode.trim()

        const existingCoupon = await Coupons.findOne({
            couponCode: { $regex: new RegExp(`^${trimmedCouponCode}$`, "i") },
            _id: { $ne: couponId }, 
        })
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }
        
        const updates = {
            couponCode:trimmedCouponCode,
            discount,
            usageLimit,
            expDate : new Date(expDate) 
        }
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
        const updateCoupon = await Coupons.findByIdAndUpdate(couponId,updates,{ new: true})
        if(!updateCoupon){
            return res.status(400).json({success:false, message:'Coupon not found'})
        }
        res.status(200).json({ success: true, message:'coupon edited successfully'})
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error in editing coupon'})
    }
}

//delete a coupon
exports.deleteCoupon = async(req,res)=>{
    try {
        const { couponId } = req.body
        const deleteCoupon = await Coupons.findByIdAndDelete(couponId)
        if(deleteCoupon){
            res.status(200).json({ success: true, message: 'Coupon deleted successfully'})

        }else{
            res.status(400).json({ success: false, message: 'Not found coupon'})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error in deleting coupon'})     
    }
}

//offers
exports.listOffers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));

        const totalOffers = await Offers.countDocuments();

        // Fetch paginated offers with sorting
        const offers = await Offers.find()
            .sort({ createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber) 
            .limit(limitNumber); 

    
        const totalPages = Math.ceil(totalOffers / limitNumber);

       
        res.render('admin/offer', {
            offers,
            currentPage: pageNumber,
            totalPages,
            totalOffers,
            limit: limitNumber,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

//add offer
exports.addOffer = async(req,res)=>{
    const { title, type, discount, startDate, endDate } = req.body
    try {

        const trimmedOfferTitle = title.trim()
        const existingOffer  =  await Offers.findOne({ title: { $regex: new RegExp(`^${trimmedOfferTitle}$`,"i")}})
        if(existingOffer){
            return res.status(400).json({ success:false, message:'Offer title is already exists'})
        }

        const offer = new Offers({
            title:trimmedOfferTitle,
            type,
            discount,
            startDate,
            endDate
        })

        await offer.save()
        res.status(200).json({ success: true, message: 'Offer added successfully',offer})

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message:'something went wrong'})
        
    }
}

//edit offer
exports.editOffer = async(req,res)=>{
    
    const  { offerId, title, type, discount,  startDate, endDate } = req.body

    try {

        const trimmedOfferTitle = title.trim()
        const existingOffer  =  await Offers.findOne({ title: { $regex: new RegExp(`^${trimmedOfferTitle}$`,"i")}, _id:{$ne: offerId}})
        if(existingOffer){
            return res.status(400).json({ success:false, message:'Offer title is already exists'})
        }

        const updateOffer = await Offers.findByIdAndUpdate(offerId,{
            title:title.trim(),
            type,
            discount,
            startDate,
            endDate, 
            isActive:true
        },{
            new: true
        })

        if(!updateOffer) return res.status(404).json({ success:false, message: 'Offer not found'})


        // Update products or categories associated with this offer
        if (type === 'product') {
            await Product.updateMany(
                { offerId: offerId }, 
                {
                    offerDiscount: discount,
                }
            );
        } else if (type === 'category') {
            await Category.updateMany(
                { offerId: offerId },
                {
                    offerDiscount: discount, 
                }
            );

           await Product.updateMany(
            { offerId },
            {
              offerDiscount: discount,
                
            }
           )
        }
        
            
        res.status(200).json({ success: true, message: 'Offer updated successfully',updateOffer})
    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message:'Something went wrong'})
        
        
    }
}

//delete offer
exports.deleteOffer = async(req,res)=>{
    const { offerId } = req.params

    try {
        const offer = await Offers.findByIdAndDelete(offerId)
        if(!offer) return res.status(404).json({ success:false, message: 'offer not found'})

         await Product.updateMany({offerId},{
            offerId:null,
            offerDiscount:0,
            offerApplied:false
         })

         await Category.updateMany({offerId},{
            offerId:null,
            offerDiscount:0,
            offerApplied:false
         })

        // Delete the offer
        await Offers.findByIdAndDelete(offerId);
        res.status(200).json({ success:true, message:'Offer deleted successfully'})
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false, message:'something went wrong'})
        
    }
}

//apply coupon for category
exports.applyOffertoCategory = async (req, res) => {
    try {
        const { categoryId, offerId } = req.body;

        if(!offerId){
            const category =await Category.findById(categoryId)
            const products = await Product.find({category: categoryId })

            for(const product of products){
                
                product.offerId = null
                product.offerApplied = false
                product.offerDiscount = 0
                await product.save()
                
            }
            
            category.offerId = null;
            category.offerApplied = false;
            category.offerDiscount = 0
            await category.save()

            

            return res.json({ success:true, message: 'Offer removed successfully'})
        }
        
        const category = await Category.findById(categoryId);
        const products = await Product.find({ category: categoryId });

        const offer = await Offers.findById(offerId);
        if(offer.endDate <= new Date()){
            return res.status(400).json({success:false, message:'Offer expired'})
        }

        category.offerId = offerId
        category.offerApplied = true;
        category.offerDiscount = offer.discount;
        await category.save();

      
        for (const product of products) {
            product.offerId = offerId
            product.offerApplied = true;
            product.offerDiscount = offer.discount;
            await product.save();
        }

       
        res.json({ success: true, message: 'Offer successfully applied to category and related products.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to apply the offer. Please try again later.' });
    }
};

//apply to product offer
exports.applyOffertoProducts = async(req,res)=>{
    try {
        const { productId, offerId } = req.body

        if(!offerId){
            const product = await Product.findById(productId)
            product.offerId = null;
            product.offerApplied = false;
            product.offerDiscount = 0
            await product.save()
            return res.json({ success:true, message:'Offer removed successfully'})
        }

        const product = await Product.findById(productId)
        const offer = await Offers.findById(offerId)
        if(offer.endDate <= new Date()){
            return res.status(400).json({ success:false, message:'Offer expired'})
        }

        product.offerId = offerId
        product.offerApplied = true;
        product.offerDiscount = offer.discount
        await product.save()

        res.status(200).json({ success:true, message: 'Offer successfully applied to the product'})


    } catch (error) {
        console.log(error);
        res.status(400).json({ success:false, message: 'Failed to apply the offer'})
        
    }
}


//sales report
exports.getSalesReport = async (req, res) => {
    try {
        const { dateRange, startDate, endDate } = req.query;
        let filter = {};
        const now = new Date();
        

        switch (dateRange) {
            case 'daily': {
                const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)); // Midnight UTC
                const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)); // End of the day UTC
                filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
                break;
            }
            case 'weekly': {
                const startOfWeek = new Date(now);
                startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay()); 
                startOfWeek.setUTCHours(0, 0, 0, 0); 
        
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
                endOfWeek.setUTCHours(23, 59, 59, 999); 
        
                filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
                break;
            }
            case 'monthly': {
                const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); 
                const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)); 
                filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
                break;
            }
            case 'yearly': {
                const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); 
                const endOfYear = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999)); 
                filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
                break;
            }
            case 'custom': {
              
                if (isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
                    return res.status(400).json('Invalid date range');
                }
                
                filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
                break;
            }
             
        }
        
        const orders = await Order.find(filter).populate('items.product');

        // Metrics calculation
        const deliveredOrders = orders.filter(order => order.status === 'Delivered')
        const totalSales = deliveredOrders.reduce((sum, order) => sum + order.totalPriceAfterDiscount, 0);
        const totalOrders = deliveredOrders.length;
        const totalDiscount = deliveredOrders.reduce((sum, order) => sum + order.discountAmount, 0);
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        const topProducts = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const productId = item.product._id.toString();
                if (!topProducts[productId]) {
                    topProducts[productId] = { name: item.product.name, units: 0, revenue: 0 };
                }
                topProducts[productId].units += item.quantity;
                topProducts[productId].revenue += item.price * item.quantity;
            });
        });

        const sortedTopProducts = Object.values(topProducts)
            .sort((a, b) => b.units - a.units)
            .slice(0, 5);

        const orderStatusBreakDown = orders.reduce((counts, order) =>{
            counts[order.status] = (counts[order.status] || 0) + 1
            return counts;
        },{})

        const salesByMonth = Array.from({ length: 12 }, (_, i) => ({
            month: new Date(0, i).toLocaleDateString('default', { month: 'short' }), 
            sales: 0,
            discount: 0,
        }));
        
        deliveredOrders.forEach(order => {
            const monthIndex = order.createdAt.getMonth();
            salesByMonth[monthIndex].sales += order.totalPriceAfterDiscount;
            salesByMonth[monthIndex].discount += order.discountAmount;
        });
      
        const salesByMonthData = salesByMonth.map(data => ({
            month: data.month,
            sales: data.sales,
            discount: data.discount,
        }));

        res.json({
            orders,
            totalSales:totalSales || 0,
            totalOrders: totalOrders || 0,
            avgOrderValue: avgOrderValue || 0,
            totalDiscount: totalDiscount || 0,
            orderStatusBreakDown,
            salesByMonthData,
            topProducts: sortedTopProducts,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json('Error generating sales report');
    }
};


//Download excel 
exports.exportToExcel = async (req, res) => {
    try {
        const { dateRange, startDate, endDate } = req.query;

        // Filter based on date range
        const filter = {};
        const now = new Date();

        switch (dateRange) {
            case 'daily': {
                const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
                filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
                break;
            }
            case 'weekly': {
                const startOfWeek = new Date(now);
                startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay());
                startOfWeek.setUTCHours(0, 0, 0, 0);
        
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
                endOfWeek.setUTCHours(23, 59, 59, 999);
                filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
                break;
            }
            case 'monthly': {
                const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
                filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
                break;
            }
            case 'yearly': {
                const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
                const endOfYear = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
                filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
                break;
            }
            case 'custom': {
                if (startDate && endDate) {
                    filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
                }
                break;
            }
        }

        const orders = await Order.find(filter).populate('items.product');

        // Calculate sales metrics
        const deliveredOrders = orders.filter(order => order.status === 'Delivered')
        const totalSales = deliveredOrders.reduce((sum, order) => sum + order.totalPriceAfterDiscount, 0);
        const totalOrders = deliveredOrders.length;
        const totalDiscount = deliveredOrders.reduce((sum, order) => sum + order.discountAmount, 0);

        const topProducts = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const productId = item.product._id.toString();
                if (!topProducts[productId]) {
                    topProducts[productId] = { name: item.product.name, units: 0, revenue: 0 };
                }
                topProducts[productId].units += item.quantity;
                topProducts[productId].revenue += item.quantity * item.price;
            });
        });

        const sortedTopProducts = Object.values(topProducts)
            .sort((a, b) => b.units - a.units)
            .slice(0, 5);

        // Create the workbook and add the sheets
        const workbook = new ExcelJS.Workbook();

        // Overview Sheet
        const overviewSheet = workbook.addWorksheet('Overview');
        overviewSheet.addRow(['Metric', 'Value']);
        overviewSheet.addRow(['Total Sales', totalSales]);
        overviewSheet.addRow(['Total Orders', totalOrders]);
        overviewSheet.addRow(['Total Discount', totalDiscount]);

        sortedTopProducts.forEach((product, index) => {
            overviewSheet.addRow([`Top Product #${index + 1}`, `${product.name} - ${product.units} units, ₹${product.revenue}`]);
        });

        // Orders Sheet
        const ordersSheet = workbook.addWorksheet('Orders');
        ordersSheet.columns = [
            { header: 'Order ID', key: '_id', width: 30 },
            { header: 'Date', key: 'createdAt', width: 15 },
            { header: 'Total Amount', key: 'totalPriceAfterDiscount', width: 15 },
            { header: 'Discount Amount', key: 'discountAmount', width: 15 },
            { header: 'Payment Status', key: 'paymentStatus', width: 15 },
            { header: 'Order Status', key: 'status', width: 15 },
        ];

        orders.forEach(order => {
            ordersSheet.addRow({
                _id: order._id.toString(),
                createdAt: order.createdAt.toISOString().split('T')[0],
                totalPriceAfterDiscount: order.totalPriceAfterDiscount,
                discountAmount: order.discountAmount,
                paymentStatus: order.paymentStatus,
                status: order.status,
            });
        });

        // Set headers and send the file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json('Error exporting to Excel');
    }
};


//Download pdf
exports.exportToPDF = async (req, res) => {
    try {
        const { dateRange, startDate, endDate } = req.query;

        // Filter based on date range
        const filter = {};
        const now = new Date();

        switch (dateRange) {
            case 'daily': {
                const startOfDay = new Date(now.setHours(0, 0, 0, 0));
                const endOfDay = new Date(now.setHours(23, 59, 59, 999));
                filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
                break;
            }
            case 'weekly': {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);
                filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
                break;
            }
            case 'monthly': {
                const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
                filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
                break;
            }
            case 'yearly': {
                const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
                const endOfYear = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
                filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
                break;
            }
            case 'custom': {
                if (startDate && endDate) {
                    filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
                }
                break;
            }
        }

        const orders = await Order.find(filter).populate('items.product');

        // Calculate sales metrics
        const deliveredOrders = orders.filter(order => order.status === 'Delivered')
        const totalSales = deliveredOrders.reduce((sum, order) => sum + order.totalPriceAfterDiscount, 0);
        const totalOrders = deliveredOrders.length;
        const totalDiscount = deliveredOrders.reduce((sum, order) => sum + order.discountAmount, 0);

        const topProducts = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const productId = item.product._id.toString();
                if (!topProducts[productId]) {
                    topProducts[productId] = { name: item.product.name, units: 0, revenue: 0 };
                }
                topProducts[productId].units += item.quantity;
                topProducts[productId].revenue += item.quantity * item.price;
            });
        });

        const sortedTopProducts = Object.values(topProducts)
            .sort((a, b) => b.units - a.units)
            .slice(0, 5);

        // Generate PDF
        const pdfDoc = new PDFDocument();
        const filePath = path.join(__dirname, '../public/reports/sales_report.pdf');

        pdfDoc.pipe(fs.createWriteStream(filePath)); 
        pdfDoc.pipe(res); // Stream to client

        // Header
        pdfDoc.fontSize(20).text('Sales Report', { align: 'center' }).moveDown();

        // Overview Section
        pdfDoc.fontSize(14).text('Overview', { underline: true }).moveDown(0.5);
        pdfDoc.fontSize(12).text(`Total Sales: ₹${totalSales.toFixed(2)}`);
        pdfDoc.text(`Total Orders: ${totalOrders}`);
        pdfDoc.text(`Total Discount: ₹${totalDiscount.toFixed(2)}`).moveDown(1);

        sortedTopProducts.forEach((product, index) => {
            pdfDoc.text(`Top Product #${index + 1}: ${product.name} - ${product.units} units, ₹${product.revenue.toFixed(2)}`);
        });

        pdfDoc.moveDown(1);

        // Orders Section
        pdfDoc.fontSize(14).text('Order Details', { underline: true }).moveDown(0.5);
        pdfDoc.fontSize(12).text('Order ID | Date | Total Amount | Discount | Payment Status | Order Status');
        pdfDoc.text('------------------------------------------------------------');

        orders.forEach(order => {
            pdfDoc.text(`Order ID: ${order._id}`);
            pdfDoc.text(`Date: ${order.createdAt.toISOString().split('T')[0]}`);
            pdfDoc.text(`Total Amount: ₹${order.totalPriceAfterDiscount.toFixed(2)}`);
            pdfDoc.text(`Discount Amount: ₹${order.discountAmount.toFixed(2)}`);
            pdfDoc.text(`Payment Status: ${order.paymentStatus}`);
            pdfDoc.text(`Order Status: ${order.status}`);
            pdfDoc.text('------------------------------------------------------------');
        });

        pdfDoc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json('Error exporting to PDF');
    }
};
//handle logout
exports.logout = (req,res) => {
   req.session.destroy(err =>{
    if(err){
        return res.redirect('/admin/dashboard') 
    }
    res.clearCookie('connet.sid') 
    res.redirect('/admin/login')
   })
}


