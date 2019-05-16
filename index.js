'use strict';

exports.handler = (event, context, callback) => {
  // ================================
  // Define your backups
  // ================================

  const instanceName = "Ubuntu-Instance" // Put your instance name here http://take.ms/dChbs
  const backupDaysMax = 7; // keep at least 7 daily backups 
  const backupWeeksMax = 4; // keep at least 4  weekly  backups
  const backupMonthsMax = 2; // keep at least 3  monthly  backups

  // ================================        
  // Unique short tag for snapshots
  // ================================

  const labelTag = "Lambda" // Use labelTag to avoid the conflict with overriding of the backups from different instances you have.
  // Set it differently in your Lambdas for different instances. For "ABC" label it would be ABCKW8TAG6 the name of the backups 


  // ================================        
  // Create an AWS Lightsail client
  // ================================

  var AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-west-2' });
  var Lightsail = new AWS.Lightsail();

  // ================================        
  // Dates calculations for the name
  // ================================

  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var diff = now - start;
  var oneDay = 1000 * 60 * 60 * 24;
  var kw = Math.floor(diff / oneDay / 7) + 1;
  var day = Math.floor(diff / oneDay)

  console.log('KW of year: ' + kw);
  console.log('day of year:' + day);
  console.log('day of month:' + now.getDate());
  console.log('day of week:' + now.getDay());
  console.log('month:' + now.getMonth());

  var backupDaysNR = now.getDay() % backupDaysMax;
  var backupWeeksNR = kw % backupWeeksMax;
  var backupMonatsNR = now.getMonth() % backupMonthsMax;

  console.log('backupDaysNR:' + backupDaysNR);
  console.log('backupWeeksNR:' + backupWeeksNR);
  console.log('backupMonatsNR:' + backupMonatsNR);

  // ================================        
  // CREATE A NEW SNAPSHOT
  // ================================

  var params = {
    "instanceSnapshotName": "KW" + kw + "TAG" + backupDaysNR
  }

  Lightsail.getInstanceSnapshot(params, function (err, data) {
    if (err) { //console.log(err, err.stack); // an error occurred
      console.log('no backup, we do it new');
      newDaySnapshot(instanceName, "KW" + kw + "TAG" + backupDaysNR)

    }
    else {
      console.log(data);  // successful response

      // delete old backup
      Lightsail.deleteInstanceSnapshot(params, function (err, data) {
        if (err) {
          // console.log(err, err.stack); // an error occurred
        }
        else {
          console.log(data); // successful response
          newDaySnapshot(instanceName, backupDaysNR)
        }
      });
    }
  });

  function newDaySnapshot(instanceName, backupDaysNR) {
    var params = {
      instanceName: instanceName,
      instanceSnapshotName: labelTag + backupDaysNR
    };
    Lightsail.createInstanceSnapshot(params, function (err, data) {
      if (err) {
        // console.log(err, err.stack); // an error occurred
      }
      else {
        console.log(data); // successful response
      }
    });
  }

  // ================================        
  //  DELETING OLD SNAPSHOTS
  // ================================

  var params = {};
  var backupDaysTillNow;
  var saveBackup;
  var backupDate;
  var NameOfSnapshot;

  Lightsail.getInstanceSnapshots(params, getSnapshots);

  function getSnapshots(err, data) {
    if (err) {
      console.log(err, err.stack); // an error occurred
    }
    else {
      for (var i = 0; i < data.instanceSnapshots.length; i++) { // BROWSE THROUGH SNAPSHOTS
        var backupFromInstance = data.instanceSnapshots[i].fromInstanceName;
        backupDate = new Date(data.instanceSnapshots[i].createdAt);
        backupDaysTillNow = Math.floor((now - backupDate) / oneDay);
        saveBackup = false;
        if (backupFromInstance == instanceName) {
                // DO NOT DELETE Manual Backups
                NameOfSnapshot = data.instanceSnapshots[i].name;
                if (!NameOfSnapshot.includes(labelTag)) { saveBackup = true; }
                // DO NOT DELETE LAST backupDaysMax DAYS BACKUPS
                if (backupDaysTillNow <= backupDaysMax) { saveBackup = true; }
                // DO NOT DELETE LAST backupWeeksMax WEEKS BACKUPS
                if (backupDaysTillNow > backupDaysMax && backupDaysTillNow <= backupWeeksMax * 7 && backupDate.getDay() == 0) { saveBackup = true; }
                // DO NOT DELETE LAST backupWeeksMax MONTHS BACKUPS
                if (backupDaysTillNow > backupWeeksMax * 7 && backupDaysTillNow <= backupMonthsMax * 30 && backupDate.getDate() < 8 && backupDate.getDay() == 0) { saveBackup = true; }

                if (saveBackup) {
                // WE KEPT THESE BACKUPS
                console.log(`kept ${backupDate.getDate()} ${data.instanceSnapshots[i].createdAt}  ${data.instanceSnapshots[i].name}`);
                } else {
                // WE DELETED THESE BACKUPS
                var paramsDelete = {
                    "instanceSnapshotName": data.instanceSnapshots[i].name
                }
                Lightsail.deleteInstanceSnapshot(paramsDelete, function () {

                    if (err) console.log(err, err.stack);
                     else console.log(`Deleted ${paramsDelete.instanceSnapshotName}`);
                });
                }
        } else {

            console.log('Will ignore this backup because it belongs to an instance other than ' + instanceName);
        }
      }

      // IF WE HAVE MORE BACKUPS WE SHOULD NAVIGATE TO THE NEXT PAGE AND USE RECURSION
      console.log('\n\r=============== TOKEN =============== ');
      console.log(data.nextPageToken);
      if (typeof data.nextPageToken != 'undefined') {
        var params = {
          pageToken: data.nextPageToken
        };
        Lightsail.getInstanceSnapshots(params, getSnapshots);
      }
    }
  }
};
