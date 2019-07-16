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
const FETCH_MAX = 10;
const SALT_ROUNDS = 10;
const url = 'mongodb://localhost:27017';
const dbName = 'SNY9036PY24';
var upload = multer({dest: 'uploads/images/'});
var db;

var app = express();
app.use(express.static('./static'));
app.use(express.static('./uploads'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({secret: 'abcdefg', resave: false, saveUninitialized: false}));
app.set('view engine', 'ejs');
app.set('views', './views');

const msg_err = 'エラーが発生しました。';
const msg_err_not_login = 'ログインが必要です。';
const msg_err_login = 'メールアドレスもしくはパスワードに誤りがありあす。';
const msg_err_mail = 'メールアドレスがすでに登録されています。';
const msg_err_insert = '投稿するメッセージおよび画像がありません。';
const msg_err_withdraw = 'パスワードに誤りがありあす。';
const msg_insert = '投稿を新規登録しました。';
const msg_update = '投稿が編集されました。';
const msg_delete = '投稿を削除しました。';
const msg_img_delete = '画像が削除されました。';
const msg_index = '件が掲示されました。';
const msg_no_index = '掲示する投稿がありません。'; 
const msg_withdraw_password = '脱退するためにパスワードを再び入力してください。';
const msg_regist = 'ユーザー登録が完了しました。<br>'
                + 'ログインの際には以下のメールアドレスと登録時に設定したパスワードをご使用ください。<br>';
const msg_token = 'トークンを発行しました。<br>';
const msg_withdraw = '脱退しました。投稿内容もすべて削除されています。<br> 今までご利用いただきありがとうございました。';

// エラー処理
function catch_error(err, req, res, render) {
    console.log(err);
    var vars;
    switch (render) {
        case 'regist':
            if (err.code == 11000) {
                vars = {message: msg_err_mail}; // メールアドレスがすでに登録されています。
            } else {
                vars = {message: msg_err};
            }
            break;
        case 'login':
            vars = {message: msg_err};
            break;
        case 'write':
            if (err == 'no_insert') {
                vars = {
                    message: msg_err_insert, // 投稿するメッセージおよび画像がありません。
                    login_user: req.session.user_id,
                    image: req.body.h_img, 
                    text_message: req.body.h_message,
                    post_id: '',
                    no_img: ''
                };                
            } else {
                vars = {
                    message: msg_err,
                    login_user: req.session.user_id,
                    image: req.body.h_img, 
                    text_message: req.body.h_message,
                    post_id: '',
                    no_img: ''
                };
            }
            break;
        case 'index':
            if (err == 'login_err') {
                vars = {
                    message: msg_err_not_login, // ログインが必要です。
                    login_user: req.session.user_id,
                    links: [],
                    posts: []
                };
            } else {
                vars = {
                    message: msg_err,
                    login_user: req.session.user_id,
                    links: [],
                    posts: []
                };
            }
            break;
    }
    res.render(render, vars);
};

// G1
app.get('/', function(req, res) {
    res.redirect('/index/');
});

// G2 : post.find.aggregate(user)
app.get('/index/*', async function(req, res) {
    var user_id, link_num;
    if (req.params[0].split('/')[0] == 'user') {
        user_id = req.session.user_id;
        if (req.params[0].split('/')[1]) {
            link_num = req.params[0].split('/')[1];
        }
    } else {
        link_num = req.params[0].split('/')[0];
    }
    try {
        var post_collection = db.collection('post');
        var post_query;
        if (user_id) {
            post_query = {user_id: user_id};
        }
        var post_results = await post_collection.find(post_query).toArray();
        var links = [
            post_results.length,
            FETCH_MAX,
            link_num,
            user_id
        ];
        var message = '';
        var posts = [];
        if (user_id) {
            message = user_id + 'でのみ';
        }
        if (post_results.length == 0) {
            message += msg_no_index; // 掲示する投稿がありません。
        } else {
            message += post_results.length + msg_index; // 件が掲示されました。
            var cursor;
            var lookup = [{
                $lookup: {
                    from: 'user', 
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            }];
            if (user_id) {
                lookup.push({
                    $match: {
                        user_id: user_id
                    }
                });
            }
            if (link_num > 1) {
                cursor = post_collection.aggregate(lookup).sort({time: -1})
                .skip((parseInt(link_num) - 1) * FETCH_MAX).limit(FETCH_MAX);
            } else {
                cursor = post_collection.aggregate(lookup).sort({time: -1}).limit(FETCH_MAX);
            }
            post_results = await cursor.toArray();
            posts = post_results.map(function(post) {
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
        }
        var vars = {
            message: message,
            login_user: req.session.user_id,
            links: links,
            posts: posts
        };
        res.render('index', vars);
    } catch (err) {
        catch_error(err, req, res, 'index');
    }
});

// G3
app.get('/login', function(req, res) {
    var vars = {message: ''};
    res.render('login', vars);
});

// G4
app.get('/logout', function(req, res) {
    req.session.destroy();
    res.redirect('/index/');
});

// G5
app.get('/regist', function(req, res) {
    var vars = {message: ''};
    res.render('regist', vars);
});

// G6
app.get('/withdraw', function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    var vars = {
        message: msg_withdraw_password, // 脱退するためにパスワードを再び入力してください。
        login_user: req.session.user_id, 
        need_password: 'withdraw'
    };
    res.render('comp', vars);
});

// G6 : user.update
app.get('/token', async function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    try {
        var user_collection = db.collection('user');
        var token = uuid.v4();
        var user_query = {_id: req.session.user_id};
        var new_val = {$set: {token: token}};
        await user_collection.updateOne(user_query, new_val);
        var vars = {
            message: msg_token + token, // トークンを発行しました。<br>
            login_user: req.session.user_id,
            need_password: ''
        };
        res.render('comp', vars);
    } catch (err) {
        catch_error(err, req, res, 'index');
    }
});

// G7
app.get('/write', function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    var vars = {
        message: '',
        login_user: req.session.user_id,
        image: req.body.h_img,
        text_message: req.body.h_message,
        post_id: '',
        no_img: ''
    };
    res.render('write', vars);
});

// P1 : user.find
app.post('/login', async function(req, res) {
    try {
        var user_collection = db.collection('user');
        var user_query = {_id: req.body.mail};
        var user_result = await user_collection.findOne(user_query);
        var loginOk = false;
        if (user_result) {
            loginOk = await bcrypt.compare(req.body.password, user_result.password);
        }
        if (loginOk) {
            req.session.user_id = user_result._id;
            res.redirect('/index/');
        } else {
            var vars = {message: msg_err_login}; // メールアドレスもしくはパスワードに誤りがありあす。
            res.render('login', vars);
        }
    } catch (err) {
        catch_error(err, req, res, 'login');
    }
});

// P2 : user.insert
app.post('/regist', async function(req, res) {
    try {
        var hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
        var user_collection = db.collection('user');
        var user = {
            _id: req.body.mail,
            name: req.body.name,
            password: hash
        }
        await user_collection.insertOne(user);
        var vars = {
            login_user: req.session.user_id,
            message: msg_regist + req.body.mail, // ユーザー登録が完了しました。
                                                // ログインの際には以下のメールアドレスと登録時に設定したパスワードをご使用ください。
            need_password: ''
        };
        res.render('comp', vars);
    } catch (err) {
        catch_error(err, req, res, 'regist');
    }
});

// P3 : user.find.delete, post.delete
app.post('/withdraw', async function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    try {
        var user_id = req.session.user_id;
        var user_collection = db.collection('user');
        var user_query = {_id: user_id};
        var user_result = await user_collection.findOne(user_query);
        var loginOk = false;
        if (user_result) {
            loginOk = await bcrypt.compare(req.body.password, user_result.password);
        }
        var vars;
        if (loginOk) {
            await user_collection.deleteOne(user_query);
            var post_collection = db.collection('post');
            post_query = {user_id: user_id};
            await post_collection.deleteMany(post_query);
            req.session.destroy();
            vars = {
                message: user_id + 'の' + msg_withdraw, // 脱退しました。投稿内容もすべて削除されています。
                                                        // 今までご利用いただきありがとうございました。
                login_user: '',
                need_password: ''
            };
        } else {
            vars = {
                message: msg_err_withdraw + msg_withdraw_password, // パスワードに誤りがありあす。
                                                                   // 脱退するためにパスワードを再び入力してください。
                login_user: req.session.user_id,
                need_password: 'need_password'
            };
        }
        res.render('comp', vars);
    } catch (err) {
        catch_error(err, req, res, 'index');
    }
});

// P4 : post.insert.update
app.post('/write/*', async function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    var post_id = req.params[0].split('/')[0];
    var message;
    try {
        var post_collection = db.collection('post');
        if (!post_id) {
            message = msg_insert; // 投稿を新規登録しました。
            if (req.body.h_img) {
                var filename = '.\\\\uploads' + req.body.h_img.split('/').join('\\\\');
                fs.readFile(filename, async function(err, data) {
                    if (err) {
                        throw err;
                    }
                    var post = {
                        message: req.body.text_message,
                        time: new Date(), 
                        user_id: req.session.user_id,
                        img: data
                    }
                    await post_collection.insertOne(post);
                    fs.unlink(filename, function(err, data) {
                        if (err) {
                            throw err;
                        }
                    });
                });
            } else {
                if (!req.body.text_message) {
                    catch_error('no_insert', req, res, 'write'); // 投稿するメッセージおよび画像がありません。
                    return;
                }
                var post = {
                    message: req.body.text_message,
                    time: new Date(), 
                    user_id: req.session.user_id,
                }
                await post_collection.insertOne(post);    
            }
        } else {
            message = msg_update; // 投稿が編集されました。
            var post_query = {
                _id: new mongoDB.ObjectID(post_id),
                user_id: req.session.user_id
            };
            if (req.body.h_img) {
                if (req.body.h_img.split('/')[1] == 'images') {
                    var filename = '.\\\\uploads' + req.body.h_img.split('/').join('\\\\');
                    fs.readFile(filename, async function(err, data) {
                        if (err) {
                            throw err;
                        }
                        var new_val = {
                            $set: {
                                message: req.body.text_message,
                                time: new Date(), 
                                img: data
                            }
                        };
                        await post_collection.updateOne(post_query, new_val);
                        fs.unlink(filename, function(err, data) {
                            if (err) {
                                throw err;
                            }
                        });                 
                    });
                } else {
                    var new_val = {
                        $set: {
                            message: req.body.text_message,
                            time: new Date()
                        }
                    };
                    await post_collection.updateOne(post_query, new_val);
                }
            } else {
                if (!req.body.text_message) {
                    catch_error('no_insert', req, res, 'write'); // 投稿するメッセージおよび画像がありません。
                    return;
                }
                var new_val = {
                    $set: {
                        message: req.body.text_message,
                        time: new Date(),
                        img: ''
                    }
                };
                await post_collection.updateOne(post_query, new_val);
            }
        }
    } catch (err) {
        catch_error(err, req, res, 'write');
    }
    var vars = {
        message: message,
        login_user: req.session.user_id,
        links: [],
        posts: []
    };
    res.render('index', vars);
});

// P5
app.post('/upload/*', upload.single('file'), function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    var post_id = req.params[0].split('/')[0];
    var image = '';
    if (req.file) {
        image = '/images/' + req.file.filename;
    } 
    var vars = {
        message: '',
        login_user: req.session.user_id,
        image: image,
        text_message: req.body.h_message,
        post_id: post_id,
        no_img: 'no_img'
    };
    res.render('write', vars);
});

// P6 : post.find.update
app.post('/cancel/*', async function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    var post_id = req.params[0].split('/')[0];
    var message = '';
    if (post_id) {
        try {
            var post_collection = db.collection('post');
            var post_query = {
                _id: new mongoDB.ObjectID(post_id),
                user_id: req.session.user_id
            };
            var post_result = await post_collection.findOne(post_query);
            if (post_result.img) {
                var new_val = {
                    $set: {
                        time: new Date(),
                        img: ''
                    }
                };
                await post_collection.updateOne(post_query, new_val);
                message = msg_img_delete;
            }
        } catch (err) {
            catch_error(err, req, res, 'write');
        }
    }
    var vars = {
        message: message,
        login_user: req.session.user_id,
        image: '',
        text_message: req.body.h_message,
        post_id: post_id,
        no_img: 'no_img'
    };
    res.render('write', vars);
});

// P7 : post.delete
app.post('/delete/*', async function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    var post_id = req.params[0].split('/')[0];
    try {
        var post_collection = db.collection('post');
        var post_query = {
            _id: new mongoDB.ObjectID(post_id),
            user_id: req.session.user_id
        };
        await post_collection.deleteOne(post_query);
        var vars = {
            message: msg_delete,
            login_user: req.session.user_id,
            links: [],
            posts: []            
        };
        res.render('index', vars);
    } catch (err) {
        catch_error(err, req, res, 'index');
    }
});

// P8 : post.find
app.post('/edit/*', async function(req, res) {
    if (!req.session.user_id) {
        catch_error('login_err', req, res, 'index');
        return;
    }
    var post_id = req.params[0].split('/')[0];
    try {
        var post_collection = db.collection('post');
        var post_query = {
            _id: new mongoDB.ObjectID(post_id),
            user_id: req.session.user_id
        };
        var post_result = await post_collection.findOne(post_query);
        var image = '';
        if (post_result.img) {
            image = "data:image/jpeg;base64," + (post_result.img).toString('base64');
        }
        var vars = {
            message: '',
            login_user: req.session.user_id,
            image: image,
            text_message: post_result.message,
            post_id: post_id,
            no_img: ''
        };
        res.render('write', vars);
    } catch (err) {
        catch_error(err, req, res, 'index');
    }
});

// P9
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
        var user_collection = db.collection('user');
        var post_collection = db.collection('post');
        var user_result = await user_collection.findOne({token: req.body.token});
        if (!user_result) {
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
        await post_collection.insertOne(post);
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