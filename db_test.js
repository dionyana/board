const mongoDB = require( 'mongodb' );
const MongoClient = mongoDB.MongoClient;
const url = 'mongodb://localhost:27017';
const dbName = 'SNY9036PY24';
const path = require('path');
const fs = require('fs');

MongoClient.connect(url, {useNewUrlParser: true}, async function(err, client) {
    db = client.db(dbName);
    var collection = db.collection('post');
    
    var results = await collection.find().toArray();
    for (var i = 0; i < results.length; i++) {
        var result = await collection.deleteOne({});
        console.log(result);
    }
    var filename = '.\\uploads\\images\\3967da47c44133eeff145494c48ed67c';
    fs.readFile(filename, async function (err, data) {
        if (err) {
          if (err.code === 'ENOENT') {
            console.log('cannot open "%s".', err.path);
            process.exit(-1);
          }
          throw err;
        }
        //console.log(data);
        var post = {
            message: 'img test2 text message',
            time: new Date(), 
            user_id: 'song@xxx.com', 
            img: data
        };
        //await collection.insertOne(post);
        results = await collection.find().toArray();
        results.forEach((doc) => console.log(doc));
    });
});

