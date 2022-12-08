const express = require('express');
const router = express.Router();
const sessions = require('express-session');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const bcrypt = require('bcrypt');
const path = require('path');
const randomNumber = require('random-number');
const multer = require('multer');
const exphbs = require('express-handlebars');
const Handlebars = require('handlebars');
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');

// initialize app
const app = express();
app.engine('handlebars', exphbs.engine({
    handlebars: allowInsecurePrototypeAccess(Handlebars)
}));

// session
const secret = 'sjieu4ut49ut94u9304eifje';
const oneDay = 3600000;
router.use(sessions({
    secret: secret,
    saveUninitialized: true,
    resave: false,
    cookie: {
        maxAge: oneDay
    }
}))

// nodemailer
const transporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    secure: false,
    auth: {
        user: "beastfake8@gmail.com",
        pass: "fffdczwtceefjocd"
    }
})

transporter.use('compile', hbs({
    viewEngine: 'nodemailer-express-handlebars',
    viewPath: 'views/emailTemplates/'
}))

// server static content
router.use(express.static('uploads'));
router.use(express.static('static'));

// multer & storage
var upload = multer({
    storage: multer.diskStorage({
        destination: (req, res, cb) => {
            cb(null, './uploads');
        },
        filename: (req, file, cb) => {
            cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
        }
    })
});

const saltRounds = 10;

var session;

const userModel = require('../model/UserSchema');

router.get('/', (req, res) => {
    res.render('register', { title: 'Sign Up' });
})

router.post("/regdata", upload.single('avatar'), async (req, res) => {
    let { name, email, pass } = req.body;
    let hash = await bcrypt.hash(pass, saltRounds);
    try {
        const data = new userModel({
            username: name,
            email: email,
            password: hash,
            image: req.file.filename
        }).save().then(data => {
            let mailOption = {
                from: 'beastfake8@gmail.com',
                to: email,
                subject: 'Activion Account',
                template: 'main',
                context: {
                    username: name,
                    id: data._id
                }
            }
            transporter.sendMail(mailOption, (err, info) => {
                if (err) throw err;
                else res.render('register');
            })
        }).catch(err => {
            res.render('register');
        })
    } catch (err) {
        res.render('register', { err: true })
    }
});

router.get('/activateaccount/:id', (req, res) => {
    let id = req.params.id;
    userModel.findOne({ _id: id }, (err, data) => {
        if (err) {
            res.send("Some Thing Went Wrong")
        }
        else {
            userModel.updateOne({ _id: id }, { $set: { status: 1 } })
                .then(data1 => {
                    res.render("activate", { username: data.username })
                })
                .catch(err => {
                    res.send("Some Thing Went Wrong")
                })
        }
    })
})

router.get('/login', (req, res) => {
    res.render('login', { title: 'Sign In' });
})

router.post('/logdata', async (req, res) => {
    let { email, pass } = req.body;
    try {
        await userModel.findOne({ email: email })
            .then(data => {
                if (bcrypt.compare(pass, data.password)) {
                    session = req.session;
                    session.username = data.username;
                    res.render('dashboard', { img: data.image, title: 'Dashboard', username: session.username, style: 'dashboard.css' });
                }
            }).catch(err => {
                res.render('login', { err: true})
            })
    } catch (err) {
        res.render('login', { err: true });
    }
})

router.get('/forgetpass', (req, res) => {
    res.render('afterForgetEmail', { title: 'Change Password' });
})

var tempStorage = [];
router.post('/findemailforchangepass', async (req, res) => {
    let random = randomNumber({
        min: 1000,
        max: 9999,
        integer: true
    })
    let email = req.body.email;
    try{
    await userModel.findOne({ email: email })
        .then(data => {
            let mailOption = {
                from: 'beastfake8@gmail.com',
                to: email,
                subject: 'Reset Password',
                template: 'changeEmail',
                context: {
                    username: data.username,
                    otp: random
                }
            }
            transporter.sendMail(mailOption, (err, info) => {
                tempStorage.push(random);
                session = req.session;
                session.email = data.email;
                // const flag = localStorage.setItem('otp', temp); // --------  will check later

                res.redirect('/otpPage');
            })
        })
        .catch(err => {
            res.render('afterForgetEmail', {err : true});
        })
    }catch(err){
        res.render('afterForgetEmail', {err : true})
    }
})

router.get('/otpPage', (rerq, res) => {
    res.render('otpPage');
})

router.post('/getotp', (req, res) => {
    let otp = req.body.otp;
    // let reservedOTP = localStorage.getItem('otp') //  ------------ will check later
    let reservedOTP = "" + tempStorage[tempStorage.length - 1];
    if (otp === reservedOTP) {
        tempStorage = [];
        // localStorage.removeItem('otp');   //----------------------- will check later
        res.render('changePassword');
    }
    else {
        tempStorage = [];
        res.redirect('/forgetpass');
    }
})

router.post('/changepassword', (req, res) => {
    const pass = req.body.changepass;
    const email = req.session.email;
    const hash = bcrypt.hashSync(pass, saltRounds);
    userModel.updateOne({ email: email }, { $set: { password: hash } })
        .then(data => {
            res.render('changePassword', { succ: 'Password Changed Successfully' });
        })
        .catch(err => {
            res.render('login', { err: 'SomeThing went wrong' });
        })
})

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('register');
})

module.exports = router;