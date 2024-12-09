const express = require('express');
const app = express();
const bodyparser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const passport = require('passport');
const cron = require('node-cron')
const Offers = require('./models/offer')

dotenv.config();

// Passport configuration
require('./config/passport');

// MongoDB connect
mongoose.connect(process.env.MONGODB_CONNECT);


app.use(express.static('public'));

//auto deletion of offer
(async () => {
  try {
      console.log('Checking for expired offers on server startup...');
      await Offers.deactivateExpiredOffers();
      console.log('Expired offers deactivated successfully at startup.');
  } catch (error) {
      console.error('Error deactivating expired offers during server startup:', error);
  }
})();


cron.schedule('0 0 * * *', async () => {
  try {
      console.log('Checking for expired offers...');
      await Offers.deactivateExpiredOffers();
      console.log('Expired offers deactivated successfully.');
  } catch (error) {
      console.error('Error deactivating expired offers:', error);
  }
});

// View engine setup
app.set('view engine', 'ejs');

// Middleware
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware 
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Cache control middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Routes
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');


app.use('/admin', adminRoutes);
app.use('/', userRoutes);
app.use((req,res) =>{
  res.status(404).render('404')
})



// Start Server
app.listen(5000, () => {
  console.log('Server started on port 5000');
});
