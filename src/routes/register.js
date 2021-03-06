var express = require('express');
var router = express.Router();
var passport = require('../apis/passport');
var validator = require('express-validator');
const request = require('request');
var path = require('path');
var fs = require('fs');
var conf = require('../config');
var multer = require('multer');
var mkdirp = require('mkdirp');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    var dest = path.join(__dirname, '../public/files');
    mkdirp(dest, function (err) {
        if (err) cb(err, dest);
        else cb(null, dest);
    });
  },
  filename: function (req, file, cb) {
    cb(null, Date.now()+'-'+file.originalname);
  }
});

var upload = multer({ storage: storage });

const { check, validationResult } = require('express-validator/check');
const { matchedData, sanitize } = require('express-validator/filter');

/* GET create event page. */
router.get('/', function (req, res, next) {
  res.render('register',
    {
      errors: [],
      tab: "userTab",
      userForm: {}
    });
});



router.post('/:type', upload.any(),function (req, res, next) {
  var type = req.params.type;
  if (type == 'user') {
    // Do some checks here (all form fields have to be valid)
    req.assert('email', 'A valid email is required').isEmail();
    req.assert('password', 'passwords must be at least 8 chars long and contain one number')
      .isLength({ min: 8 })
      .matches(/\d/);
    req.assert('passwordAgain', 'Passwords do not match').equals(req.body.password);
    let errors = req.validationErrors();
    let userForm = {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    email: req.body.email,
                    password: req.body.password,
                    passwordAgain: req.body.passwordAgain
                  };

    if (!errors) {   //No errors were found. Continue with the registration!
      //SUCCESS
      passport.authenticate('local-signup-user', function (err, user, info) {
        if (err) {
          return next(err); // will generate a 500 error
        }
        if (!user) {
          errors = [{
              param: 'email',
              msg: 'Email already exists'  
          }];
          return res.status(409).render('register', { errMsg: info.errMsg, errors: errors, tab: "userTab", userForm: userForm });
        }
        req.login(user, function (err) {
          if (err) {
            console.error(err);
            return next(err);
          }
          return res.redirect('/');

        });
      })(req, res, next);
    }
    else {   //Display errors to user
      res.render('register', {
        errors: errors,
        tab: "userTab",
        userForm: userForm
      });
    }


  } else if (type == 'provider') {

    //console.log(req.files[0]);
    // Do some checks here (all form fields have to be valid)
    req.assert('email', 'A valid email is required').isEmail();  //Validate email
    req.assert('password', 'passwords must be at least 8 chars long and contain one number')
      .isLength({ min: 8 })
      .matches(/\d/);
    req.assert('passwordAgain', 'Passwords do not match').equals(req.body.password);
    // Now, some custom checks for file extension
    var fileName = req.files[0].originalname; //will check if file is indeed an image
    var fileExtension = fileName.split('.').pop();
    if ((fileExtension != "png") && (fileExtension != "jpg") && (fileExtension != "jpeg")){
       req.assert('file0', 'File should be an image').equals('dummyText');
    }
    var sizeInBytes = req.files[0].size;
    var MAXBYTESALLOWED = 6291456;
    if (sizeInBytes > MAXBYTESALLOWED) {
      req.assert('file0', 'File should be less than ' + (MAXBYTESALLOWED/(1024*1024)).toString() + ' MB').equals('dummyText');
    }
    let errors = req.validationErrors();
    let userForm = {
                    email: req.body.email,
                    legalBusinessPhone: req.body.legalBusinessPhone,
                    legalBusinessName: req.body.legalBusinessName,
                    businessSite: req.body.businessSite,
                    password: req.body.password,
                    passwordAgain: req.body.passwordAgain
                  };
    
  
    
    if (!errors) {   //No errors were found.  Passed Validation!
      //SUCCESS
      passport.authenticate('local-signup-provider', function (err, user, info) {
        if (err) {
          return next(err); // will generate a 500 error
        }
        if (!user) {
          errors = [{
              param: 'email',
              msg: 'Email already exists'  
          }];
          return res.status(409).render('register', { errMsg: info.errMsg, errors: errors, tab: "providerTab", userForm: userForm });
        }
        req.login(user, function (err) {
          if (err) {
            console.error(err);
            return next(err);
          }
          return res.redirect('/');

        });
      })(req, res, next);
    }
    else {   //Display errors to user
      res.render('register', {
        errors: errors,
        tab: "providerTab",
        userForm: userForm
      });
    }
  }
  else {
    return res.render('');
  }
});
module.exports = router;