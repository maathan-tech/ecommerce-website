const nodemailer = require('nodemailer')
const dotenv = require('dotenv')
const { text } = require('body-parser')
dotenv.config()

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
})

const sendEmail = (email, subject, text)=>{
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to:email,
        subject: subject,
        text: text
    }
    return transporter.sendMail(mailOptions)
}

module.exports = sendEmail;