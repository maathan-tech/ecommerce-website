//user if logged in 

const isUserLogged = (req,res,next)=>{
    if(req.session.user && req.session.user.role === 'user'){
        return next()
    }
    res.redirect('/login')
}


const isAdminLogged = (req,res,next)=>{
    if(req.session.user && req.session.user.role === 'admin' ){
        return next()
    }
    res.redirect('/admin/login')
}

const preventAccessForLoggedUsers = (req,res,next)=>{
    if(req.session.user){
        const role = req.session.user.role;
        return res.redirect(role === 'admin' ? '/admin/dashboard' : '/')
    }
    next()
}

module.exports = {
    isUserLogged,
    isAdminLogged,
    preventAccessForLoggedUsers
}