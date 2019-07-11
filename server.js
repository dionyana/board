const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoDB = require( 'mongodb' );
const MongoClient = mongoDB.MongoClient;
const multer = require('multer');
const fs = require('fs');
const moment = require('moment');
const uuid = require('uuid');
const FETCH_MAX = 3;
const SALT_ROUNDS = 10;
const url = 'mongodb://localhost:27017';
const dbName = 'SNY9036PY24';
var db;

var app = express();
app.use(express.static('./static'));
app.use(express.static('./uploads'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({secret: 'abcdefg', resave: false, saveUninitialized: false}));
app.set('view engine', 'ejs');
app.set('views', './views');

app.get('/regist', function(req, res) {
    res.render('regist');
});

app.post('/regist', async function(req, res) {
    try {
        var hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
        var collection = db.collection('user');
        var user = {
            _id: req.body.mail,
            name: req.body.name,
            password: hash
        }
        await collection.insertOne(user);
        var vars = {
            login_user: req.session.user_id,
            message: 
                'ユーザー登録が完了しました。' 
                 + '<br>' + 
                'ログインの際には以下のメールアドレスと登録時に設定したパスワードをご使用ください。',
            mail: req.body.mail
        };
        res.render('comp', vars);
    } catch (err) {
        console.log(err);
        var vars;
        if (err.code == 11000) {
            vars = {error: 'メールアドレスがすでに登録されています。'};
        } else {
            vars = {error: 'エラーが発生しました。'};
        }
        res.render('regist', vars);
    }
});

app.get('/login', function(req, res) {
    res.render('login');
});

app.post('/login', async function(req, res) {
    try {
        var collection = db.collection('user');
        var query = {_id: req.body.mail};
        var result = await collection.findOne(query);
        var loginOk = false;
        if (result) {
            loginOk = await bcrypt.compare(req.body.password, result.password);
        }
        if (loginOk) {
            req.session.user_id = result._id;
            res.redirect('/index/');
        } else {
            var vars = {error: 'メールアドレスもしくはパスワードに誤りがありあす。'};
            res.render('login', vars);
        }
    } catch (err) {
        console.log(err);
        var vars = {error: 'エラーが発生しました。'};
        res.render('login', vars);
    }
});

app.get('/logout', function(req, res) {
    req.session.destroy();
    res.redirect('/index/');
});

app.get('/token', async function(req, res) {
    if (!req.session.user_id) {
        console.log(err);
        var vars = {
            error: 'ログインが必要です。',
            login_user: req.session.user_id,
            links: [],
            posts: [],
            message: ''
        };
        res.render('index', vars);
        return;
    }
    try {
        var collection = db.collection('user');
        var token = uuid.v4();
        var query = {_id: req.session.user_id};
        var newValues = {$set: {token: token}};
        await collection.updateOne(query, newValues);
        var vars = {
            login_user: req.session.user_id,
            message: 'トークンを発行しました。' + token, 
            mail: ''
        };
        res.render('comp', vars);
    } catch (err) {
        console.log(err);
        var vars = {
            error: 'エラーが発生しました。',
            login_user: req.session.user_id,
            links: [],
            posts: [], 
            message: ''
        };
        res.render('index', vars);
    }
});

app.get('/write', function(req, res) {
    if (!req.session.user_id) {
        var vars = {
            error: 'ログインが必要です。',
            image: '',
            message: ''
        };
        res.render('write', vars);
        return;
    }
    var vars = {
        image: req.body.h_img,
        message: req.body.h_message
    };
    res.render('write', vars);
});

var upload = multer({dest: 'uploads/images/'});
app.post('/upload', upload.single('file'), async function(req, res) {
    try {
        var message = req.body.h_message;
        var image = '';
        if (req.file) {
            image = '/images/' + req.file.filename;
        } 
        var vars = {
            image: image,
            message: message
        };
        res.render('write', vars);
    } catch (err) {
        console.log(err);
        var vars = {
            error: 'エラーが発生しました。',
            image: '', 
            message: '' 
        };
        res.render('write', vars);  
    }
});

app.post('/cancel', function(req, res) {
    var vars = {
        image: '',
        message: req.body.h_message
    };
    res.render('write', vars);
});

app.post('/insert', async function(req, res) {
    if (!req.session.user_id) {
        console.log(err);
        var vars = {
            error: 'ログインが必要です。',
            login_user: req.session.user_id,
            links: [],
            posts: [], 
            message: ''
        };
        res.render('index', vars);
        return;
    }
    try {
        if (req.body.h_img) {
            var filename = '.\\\\uploads' + req.body.h_img.split('/').join('\\\\');
            fs.readFile(filename, async function(err, data) {
                if (err) {
                  throw err;
                }
                var post = {
                    message: req.body.message,
                    time: new Date(), 
                    user_id: req.session.user_id,
                    img: data
                }
                var collection = db.collection('post');
                await collection.insertOne(post);
                fs.unlink(filename, function(err, data) {
                    if (err) {
                        throw err;
                    }
                });
            });
        } else {
            var post = {
                message: req.body.message,
                time: new Date(), 
                user_id: req.session.user_id,
            }
            var collection = db.collection('post');
            await collection.insertOne(post);    
        }
        var vars = {
            login_user: req.session.user_id,
            links: [],
            posts: [],
            message: '投稿を登録しました。'
        };
        res.render('index', vars);
    } catch (err) {
        console.log(err);
        var vars = {
            error: 'エラーが発生しました。',
            image: '',
            message: ''
        }
        res.render('write', vars);
    }
});

app.post('/delete/*', async function(req, res) {
    if (!req.session.user_id) {
        console.log(err);
        var vars = {
            error: 'ログインが必要です。',
            login_user: req.session.user_id,
            links: [],
            posts: [], 
            message: ''
        };
        res.render('index', vars);
        return;
    }
    try {
        var post_id = req.params[0].split('/')[0];
        var query = {
            _id: new mongoDB.ObjectID(post_id),
            user_id: req.session.user_id
        };
        var collection = db.collection('post');
        var result = await collection.deleteOne(query);
        var vars = {
            login_user: req.session.user_id,
            links: [],
            posts: [],
            message: '投稿を削除しました。'
        };
        res.render('index', vars);
    } catch (err) {
        console.log(err);
        var vars = {
            error: 'エラーが発生しました。',
            login_user: req.session.user_id,
            links: [],
            posts: [], 
            message: ''
        };
        res.render('index', vars);  
    }
});

app.get('/', function(req, res) {
    res.redirect('/index/');
});

app.get('/index/*', async function(req, res) {
    try {
        var collection = db.collection('post');
        var result_all = await collection.find().toArray();

        //var link_all = Math.ceil(result_all.length / FETCH_MAX);
        var link_num = req.params[0].split('/')[0];
        var links = [
            result_all.length,
            FETCH_MAX,
            link_num
        ];

        var cursor;
        if (link_num > 1) {
            cursor = collection.aggregate([{
                $lookup: {
                    from: 'user', 
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            }]).sort({time: -1}).skip((parseInt(link_num) - 1) * FETCH_MAX).limit(FETCH_MAX);
        } else {
            cursor = collection.aggregate([{
                $lookup: {
                    from: 'user', 
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            }]).sort({time: -1}).limit(FETCH_MAX);
        }
        var results = await cursor.toArray();
        var posts = results.map(function(post) {
            var img;
            if (post.img) {
                img = "data:image/jpeg;base64," + (post.img).toString('base64');
            } else {
                img = '';
            }
            return {
                name: post.user[0].name,
                time: moment(post.time),
                message: post.message,
                user_id: post.user_id,
                post_id: post._id, 
                img: img
            }
        });
        var vars = {
            login_user: req.session.user_id,
            links: links,
            posts: posts,
            message: ''
        };
        res.render('index', vars);
    } catch (err) {
        console.log(err);
        var vars = {
            error: 'エラーが発生しました。',
            login_user: req.session.user_id,
            links: [],
            posts: [],
            message: ''
        };
        res.render('index', vars);  
    }
});

app.post('/api/post', async function(req, res) {
    if (!req.body.token) {
        res.status(400).json({
            result: 'error',
            detail: 'token is required'
        });
        return;
    }
    if (!req.body.message) {
        res.status(400).json({
            result: 'error',
            detail: 'message is required'
        });
        return;
    }
    try {
        var userCollection = db.collection('user');
        var postCollection = db.collection('post');
        var user = await userCollection.findOne({token: req.body.token});
        if (!user) {
            res.status(400).json({
                result: 'error',
                detail: 'invalid token'
            });
            return;
        }
        var post = {
            message: req.body.message,
            time: new Date(),
            user_id: user._id
        };
        await postCollection.insertOne(post);
        res.json({
            result: 'ok'
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            result: 'error',
            detail: 'internal server error'
        });
    }
});

MongoClient.connect(url, {useNewUrlParser: true}, function(err, client) {
    if (err) {
        console.log(err);
        return;
    }
    db = client.db(dbName);
    app.listen(3000, function(){
        console.log('Server started');
    });
});
