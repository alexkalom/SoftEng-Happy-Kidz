var express = require('express');
var router = express.Router();
var elastic = require('../apis/elastic_interface');
var geocoding = require('../apis/geocoding');
const request = require('request');
var path = require('path');
var fs = require('fs');
var conf = require('../config');
var auth = require('../apis/authentication');
var db = require('../models/db');
var watermark = require('../apis/watermark/watermark.js');

function validNewEvent(newEvent) {

    if (newEvent.title.length == 0)
        return false;

    if (isNaN(newEvent.startTime))
        return false;

    if (newEvent.description.length == 0) 
        return false;

    if (newEvent.geoAddress.length == 0)
        return false;

    if (isNaN(newEvent.ticketPrice))
        return false;

    if (isNaN(newEvent.ticketCount))
        return false;
    
    if (isNaN(newEvent.discount))
        return false;

    return true;
}



/* GET create event page. */
router.get('/', auth.isUserOrganizer, function(req, res, next) {
  res.render('newevent', {categories: conf.supportedCategories});
});

/* POST create event page */
router.post('/', auth.isUserOrganizer,  function(req, res, next) {
    var body = req.fields;
    var files = req.files;

    var newEvent = {};

    newEvent.organizerId = req.user.user.organizerId;

    newEvent.title = body.EventName;
    newEvent.startTime = new Date(body.Date).getTime()/1000;
    newEvent.endTime = newEvent.startTime; // this field should probably go.
    newEvent.description = body.Description;
    newEvent.categoryName = body.categoryName;
    newEvent.geoAddress = body.location;
    newEvent.ticketPrice = parseInt(body.Price);
    newEvent.ticketCount = parseInt(body.TicketNum);
    newEvent.initialTicketCount  = newEvent.ticketCount;
    newEvent.minAge = parseInt(body.AgeGroup);
    newEvent.maxAge = newEvent.minAge + 2;
    if (newEvent.minAge === 13)
        newEvent.maxAge = 200;
    newEvent.discount  = parseInt(body.Discount);
    newEvent.pictures = parseInt(body.pictures);


    //here we have collected all necessary fields we should validate them.
    if (!validNewEvent(newEvent))
        return res.send("Please fill all the necessary fields correctly");

    geocoding(newEvent.geoAddress, function(loc) {
        newEvent.geoLat = loc.lat;
        newEvent.geoLon = loc.lng;

        // at this point we can add the new Event to the database
        db.Event.create(newEvent).then(event => {
            // save uploaded images under event_eventId from 0
            if (newEvent.pictures > 0) {
                var files = req.files;

                var id = event.eventId.toString(); //here goes the id of the event
                var newdir = path.join(__dirname, '../public/files/events',  id);
                if (!fs.existsSync(newdir)){
                    fs.mkdirSync(newdir);
                }
                count=0;
                for (i in files) {
                    var newpath = path.join(newdir, count.toString());
                    count++;
                    fs.rename(files[i].path, newpath, function (err) {
                        if (err) throw err;
                    });

                    if (body.watermark)
                        watermark.addTextWatermark(newpath, newpath, 'HappyKidz').catch(err => {console.log(err);});
                }
            }

            //for now we should also add the newEvent to elasticSearch.
            newEvent.geoLocation = {
                lat: newEvent.geoLat,
                lon: newEvent.geoLon
            };
            delete newEvent.geoLat;
            delete newEvent.geoLon;

            newEvent.providerName = req.user.user.name;
            newEvent.providerPhone = req.user.user.phone;
            newEvent.eventId = event.eventId.toString();

            elastic.insert('events', newEvent, function( err, resp, status){
                if (err) {
                    console.log(err);
                }
                else {
                    console.log("insertion to elastic completed");
                }
            });

            res.send("You have submitted an event!");

        }).catch(err => {
            console.log(err);
            res.send("There was an error please try again.");
        });
    });
});

module.exports = router;
