var express = require('express');
var router = express.Router();
var db = require('../models/db');
const Sequelize = require('sequelize');
var auth = require('../apis/authentication');
var mail = require('../apis/mail');
var elastic = require('../apis/elastic_interface');



var fs = require('fs');


router.get('/:id', function(req, res, next) {
    //console.log(req.params.id);
    if(!isNaN(req.params.id) && req.params.id == parseInt(req.params.id)){
        req.params.id = parseInt(req.params.id);
        db.Event.findById(req.params.id).then(event => {
            if( event == null || !event.isVerified) {
                res.render('no_page',{user : req.user});
                return;
            }
            //Increment the event clickNumber for provider statistics
            event.increment('clickNumber',{by : 1});
            db.Organizer.findById(event.organizerId).then(provider => {
                const reviews = db.Review.findAll({
                    where : {
                        eventId : req.params.id
                    }
                }).then(reviews => {
                    var ratings = [];
                    var promises = [];
                    reviews.forEach(review => {
                        promises.push( db.Parent.findById(review.parentId).then(parent => {
                            ratings.push({
                                name : parent.name,
                                content : review.text,
                                rating : review.rating
                            });
                        }));
                    });
                    Promise.all(promises).then(function() {

                        var startDate = new Date(event.startTime*1000);
                        var isFuture = startDate > Date.now();
                        var imglist = [];
                        path = './public/files/events/' + event.eventId + "/";
                        fs.readdir(path, function(err, items) {
                            //console.log(items);
                            if(!err){
                                for (var i=0; i<items.length; i++) {
                                    imglist.push('/files/events/' + event.eventId + '/' + items[i]);
                                }
                            }
                            if(imglist.length === 0){
                                console.log(42);
                                imglist.push('/happy.png');
                            }
                            var agegroups;
                            if (event.minAge === 3){
                                agegroups = '3-5';
                            }
                            else if (event.minAge === 6){
                                agegroups = '6-8';
                            }
                            else if (event.minAge === 9){
                                agegroups = '9-12';
                            }
                            else{
                                agegroups = '>12';
                            }
                            obj = {
                                eventId : event.eventId,
                                organizerId : event.organizerId,
                                title : event.title,
                                date : startDate.toLocaleDateString(),
                                time : startDate.toLocaleTimeString(),
                                address : event.geoAddress,
                                geolon : event.geoLon,
                                geolat: event.geoLat,
                                providerName: provider.name,
                                startingPrice : (event.ticketPrice * 100 / (100 - event.discount)).toFixed(2),
                                finalPrice: event.ticketPrice.toFixed(2),
                                phone: provider.phone,
                                agegroups: agegroups,
                                description: event.description,
                                ticketCount : event.ticketCount,
                                images: imglist,
                                ratings,
                                user : req.user,
                                isFuture : isFuture
                            };
                            res.render('events',obj);
                        });

                    });
                });
            });
        });
    } else {
        console.log(42);
        res.render('no_page');
    }
});

/* Route to delete an event */

//edw thelei elastic kai sto delete kai sto put
router.delete('/:eventId', auth.isUserAdmin, function(req, res){
    var eventId = utilities.checkInt(req.params.eventId);
    if (!eventId) { res.render('no_page', {user: req.user});}
    var providerId;

    db.Event.findById(eventId)
    .then( (event) => {
        if (event && event.isVerified === false) {
            providerId = event.organizerId;
            return event.destroy();
        } else {
            res.render('no_page', {user: req.user});
        }
    })
    .then( (succ) => {
        elastic.deleteEvent(req.params.eventId);
        return db.Organizer.findById(providerId);
    })
    .then( (provider) => {
        if (provider){
        return mail.sendTextEmail('Απόρριψη Εκδήλωσης', provider.email, 'Είμαστε στη δυσάρεστη θέση να σας ενημερώσουμε ότι η εκδήλωσή σας απορρίφθηκε.');
        }
        else{
            console.log('error with provider');
            res.redirect('/admin');
        }
    })
    .then( (succ1) => {
        if (succ1) {res.redirect('/admin');}
        else{
            console.log('error with email');
            res.redirect('/admin');
        }
    });
});

/* Route to approve an event */

//edw thelei elastic kai sto delete kai sto put


router.put('/:eventId', auth.isUserAdmin, function(req, res) {

    var eventId = utilities.checkInt(req.params.eventId);
    var providerId, title, providerName;
    if (!eventId) { res.render('no_page', {user: req.user});}

    db.Event.findById(req.params.eventId)
    .then( (event) => {
        if (event && event.isVerified === false) {
            return event.update({isVerified: true}).then(() => {
                var newEvent = {};

                providerId = event.organizerId;
                title = event.title;

                newEvent.organizerId = event.organizerId;

                newEvent.title = event.title;
                newEvent.startTime = event.startTime;
                newEvent.endTime = event.endTime; // this field should probably go
                newEvent.description = event.description;
                newEvent.categoryName = event.categoryName;
                newEvent.geoAddress = event.geoAddress;
                newEvent.ticketPrice = event.ticketPrice;
                newEvent.ticketCount = event.ticketCount;
                newEvent.initialTicketCount = event.initialTicketCount;
                newEvent.minAge = event.minAge;
                newEvent.maxAge = event.maxAge;
                newEvent.discount = event.discount;
                newEvent.pictures = event.pictures;
                newEvent.geoLocation = {
                    lat: parseFloat(event.geoLat),
                    lon: parseFloat(event.geoLon)
                };

                newEvent.eventId = event.eventId.toString();

                db.Organizer.findOne({ where: { organizerId: event.organizerId } }).then((provider) => {
                    newEvent.providerName = provider.name;
                    newEvent.providerPhone = provider.phone;

                    elastic.insert('events', newEvent, function (err,resp, status) {
                        if (err)
                            console.log(err);
                    });
                });
            });
        }
        else {
            console.log('wtdf');
            return false;
        }
    })                      //send email notification for acceptance, checks might be needed
    .then ( (succ) => {
        return db.Organizer.findById(providerId);
    })
    .then ( (provider) => {
        console.log(provider);
        if (provider){
            providerName = provider.name;
            return mail.sendTextEmail('Επικύρωση Εκδήλωσης', provider.email, 'Είμαστε στην ευχάριστη θέση να σας ενημερώσουμε ότι η εκδήλωσή σας ' + title + ' επικυρώθηκε.');
        }
        else {
            console.log('error with db');
            res.redirect('/admin');
        }

    })
    .then ((succ) => {
        console.log(succ.info);
        console.log(succ);
        if (succ) {
            //find subcribers to send notification
            return db.Subscription.findAll({
                where : {
                    organizerId: providerId
                }
            });
        }
        else {
            console.log('error with email');
            return false;

        }
    }).then ((subscription) => {
        if (subscription.length > 0) {
            var promises = [];
            subscription.forEach(x => {
                promises.push(db.Parent.findById(x.parentId));
            });
            return Promise.all(promises);
        }
        else {
            console.log('no subscribers');
            return false;
        }
    }).then ((parents) => {
        if (!parents) {return false;}
        console.log(parents);
        parents.filter((x) =>  x.mailNotifications === true);
        if (parents.length > 0) {
            var maillist = [];
            for (var i = 0; i < parents.length; i++){
                maillist.push(parents[i].email);
            }
            //leipei to link
            return mail.sendTextEmail('Νέα εκδήλωσή', maillist, 'Σας ενημερώνουμε ότι δημιουργήθηκε μια νέα εκδήλωσή από τον ' + providerName + ' με τίτλο ' + title + '.');
        }
        else {
            console.log('notifications off');
            return false;
        }
    }). then ((succ) => {
        if (succ) {
            res.redirect('/admin');
        }
        else {
            console.log('error with email');
            res.redirect('/admin');
        }
    });
});

module.exports = router;