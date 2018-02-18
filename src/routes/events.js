var express = require('express');
var router = express.Router();
var db = require('../models/db');
const Sequelize = require('sequelize');

router.get('/:id', function(req, res, next) {
    //console.log(req.params.id);
    if(parseInt(req.params.id)){
        db.Event.findById(req.params.id).then(event => {
            if( event == null ) {
                res.render('no_page');
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
                    //DUMMY OBJECT
                    //TODO: Remove this dummy object
                    reviews = [
                        {
                            parentId : 1,
                            text : "Lorem ipsum",
                            rating : 4
                        },
                        {
                            parentId : 1,
                            text : "42",
                            rating : 4
                        },
                        {
                            parentId : 1,
                            text : "42",
                            rating : 4
                        },
                    ];
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
                        var imglist = [];
                        obj = {
                            title : event.title,
                            date : startDate.toLocaleDateString(),
                            time : startDate.toLocaleTimeString(),
                            address : event.geoAddress,
                            geolon : event.geoLon,
                            geolat: event.geoLat,
                            providerName: provider.name,
                            startingPrice : event.ticketPrice * 100 / (100 - event.discount),
                            finalPrice: event.ticketPrice,
                            phone: provider.phone,
                            agegroups: event.minAge + "-" + (event.minAge + 2).toString(),
                            description: event.description,
                            images: imglist,
                            ratings,
                            user : req.user
                        };
                        res.render('events',obj);
                    });
                });
            });
        });
    } else {
        res.render('no_page');
    }
});

/* Route to delete an event */

//edw thelei elastic kai sto delete kai sto put
router.delete('/:eventId', function(req, res){
    db.Event.findById(req.params.eventId).then( (event) => {
        if (event && event.isVerified === false) {
            return event.destroy();
        } else {
            res.send('No such event!')
        }
    }).then( (succ) =>
        res.redirect("/admin")
    );

});

/* Route to approve an event */

//edw thelei elastic kai sto delete kai sto put


router.put('/:eventId', function(req, res){

    db.Event.findById(req.params.eventId)
    .then( (event) => {
        if (event && event.isVerified === false) {
            return event.update({isVerified: true});
        }
        else {
            res.send('No such event!')
        }
    })
    .then ( (succ) => res.redirect("/admin"));

});

module.exports = router;
