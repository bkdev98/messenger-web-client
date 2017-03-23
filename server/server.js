const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const bodyParser = require('body-parser');
const path = require('path');
const _ = require('lodash');
const hbs = require('hbs');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const MomentHandler = require('handlebars.moment');
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '.jpg')
    }
});
const upload = multer({ storage: storage });
MomentHandler.registerHelpers(hbs);

//  Firebase Configuration

const firebase = require('firebase');

const firebaseConfig = require('./config/firebase.json');

firebase.initializeApp(firebaseConfig);

const messagesRef = firebase.database().ref("messages/");
const usersRef = firebase.database().ref("users/");
const conversationRef = firebase.database().ref("conversation/");

const middleware = require("./middleware");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 3001;

app.use('/css', express.static(__dirname + '/../public/css'));
app.use('/js', express.static(__dirname + '/../public/js'));
app.use('/fonts', express.static(__dirname + '/../public/fonts'));
app.use('/uploads', express.static(__dirname + '/../uploads'));

app.use(cookieParser());

app.use(bodyParser.urlencoded({
  extended: true
}));

hbs.registerPartials(__dirname + '/../views/partials');
app.set('view engine', 'hbs');

hbs.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
});

//  SocketIO

//  Express Routers

app.get('/', [middleware.authenticate, middleware.info, middleware.getuserlist], (req, res) => {
    res.render('index.hbs', {
        userList: req.userList,
        title: "Messenger | Home"
    }); 
});

app.get('/test', (req, res) => {
    res.render('test.hbs');
});

app.get('/messengers/:id', [middleware.authenticate, middleware.gettargetuser, middleware.getuserlist, middleware.getmessagelist], (req, res) => {
    var conversationId = req.conversationId;

    res.render('conversation.hbs', {
        messages: req.messageList,
        userList: req.userList,
        targetUser: req.targetUser,
        currentUser: req.currentUser,
        conversationId
    });

});


io.on('connection', (socket) => {
    var conversationId = null;
    socket.on('join', function (room) {

        if (socket.room) {
            // console.log(req.currentUser.fullname + " left room" + socket.room);
            socket.leave(socket.room);
        }

        socket.room = room;
        console.log(" joined room" + socket.room);
        conversationId = room;
        socket.join(socket.room);
    });

    socket.on('createMessage', (newEmail) => {
        console.log('createMessage');
        var newMessage = {
            sender: newEmail.sender,
            createdAt: new Date().getTime(),
            content: newEmail.content,
            conversationId
        };
        var newMessRef = messagesRef.push(newMessage);
        messagesRef.child(newMessRef.key).set(newMessage);
        socket.broadcast.to(conversationId).emit("newMessage", newMessage);
        messagesRef.child(newMessRef.key).on("child_added", (snapshot) => {
            console.log("stored success", snapshot.val());
        });
    });

    socket.on('disconnect', () => {
        socket.leave(conversationId);
        console.log(socket.id + ' disconnected to server');
    });
});

app.get('/login', (req, res) => {
    res.render('login.hbs');
});

app.post('/login', (req, res) => {
    const { uid, idToken } = req.body;

    usersRef.child(uid).update({ idToken })
        .then((user) => {
            res.send({redirect: '/'});
        })
        .catch((e) => {
            res.redirect('/login');
        })
})

app.get('/register', (req, res) => {
    res.render('register.hbs');
});

app.get('/info', [middleware.authenticate], (req, res) => {
    res.render('info.hbs', {
        uid: req.currentUser.uid
    });
});

app.post('/info', [middleware.authenticate], upload.array('image', 'name'), (req, res) => {
    var fullname = req.body.name;
    
    require('lwip').open(__dirname + '/../' + req.files[0].path, function(err, image) {
        if (!err) {
            image.resize(60, 60, function (err, image) {
                if (err) {
                    return console.log(err);
                }
                image.toBuffer('jpg', function (err, buffer) {
                    var avatar = Date.now() + '-' + req.files[0].filename;
                    fs.writeFile(__dirname + '/../uploads/' + avatar, buffer, function (err) {
                        if (err) {
                            return console.log(err);
                        }

                        //  Update to Firebase
                        const userRef = firebase.database().ref("users/" + req.currentUser.uid);

                        userRef.update({
                            fullname,
                            avatar
                        })
                            .then(() => {
                                res.redirect('/');
                            })
                            .catch((e) => {
                               res.redirect('/info');
                            })

                    });
                });
            });
        } else {
            console.log(err);
        }
    });
    // fs.readFile(req.files, function (err, data) {
    //     var imageName = req.files.name;
    //     if(!imageName) {
    //         console.log("There was an error");
    //         res.redirect("/");
    //         res.end();
    //     } else {
    //         console.log(imageName);
    //         var newPath = __dirname + "/uploads/" + imageName;
    //         console.log(newPath);
    //         fs.writeFile(newPath, data, function (err) {
    //             res.redirect("/uploads/" + imageName);
    //         })
    //     }
    // });
});

app.post('/register', (req, res) => {
    const newUser = {
        email: req.body.email,
        idToken: req.cookies.token,
        fullname: null
    }

    usersRef.child(req.body.uid).once("value", (snapshot) => {
        if(snapshot.val()) {
            usersRef.child(req.body.uid).update({idToken: req.cookies.token})
                .then(() => {
                    res.send({redirect: '/'});
                });
        } else {
            usersRef.child(req.body.uid).set(newUser)
                .then((user) => {
                    res.send({redirect: '/info'});
                })
                .catch((e) => {
                    res.redirect('/register');
                });
        }
    });
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

server.listen(port, () => {
    console.log(`Started on port ${port}`);
});
