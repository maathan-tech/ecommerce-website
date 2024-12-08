const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user'); // Ensure this path is correct for your User model
const dotenv = require('dotenv');

dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/callback" // Use http, not https for localhost
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if the user exists with the same email
        let user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
            if (!user.googleId) {
                // If the email exists but is not linked to Google, update the user
                user.googleId = profile.id;
                await user.save();
            }
        } else {
            // Create a new user if not found
            user = new User({
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                email: profile.emails[0].value,
                googleId: profile.id,
                password: "",
                mobile: "",
                isVerified: true,
            });
            await user.save();
        }
        done(null, user); // Authentication successful
    } catch (error) {
        if (error.code === 11000) {
            // Handle duplicate key error
            done(null, false, { message: "This email is already in use. Please log in using your credentials." });
        } else {
            done(error, null);
        }
    }
}));

passport.serializeUser((user, done) => done(null, user.id)); // Store user id in session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id); // Retrieve user from the database
        done(null, user); // Return the user
    } catch (error) {
        done(null,false, { errorMessage: "Google authentication failed. Please try again." }); // Handle any errors
    }
});
