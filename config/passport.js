const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user'); 
const dotenv = require('dotenv');

dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL 
},
async (accessToken, refreshToken, profile, done) => {
    try {
        
        let user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
            if (!user.googleId) {
                
                user.googleId = profile.id;
                await user.save();
            }
        } else {
            
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
        done(null, user); 
    } catch (error) {
        if (error.code === 11000) {
            
            done(null, false, { message: "This email is already in use. Please log in using your credentials." });
        } else {
            done(error, null);
        }
    }
}));

passport.serializeUser((user, done) => done(null, user.id)); 
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user); 
    } catch (error) {
        done(null,false, { errorMessage: "Google authentication failed. Please try again." }); 
    }
});
