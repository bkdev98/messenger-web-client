const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const bodyParser = require('body-parser');
const path = require('path');
const _ = require('lodash');
const hbs = require('hbs');
const cookieParser = require('cookie-parser');
const axios = require('axios');

//  Firebase Configuration

const firebase = require('firebase');

const firebaseConfig = require('./config/firebase.json');

firebase.initializeApp(firebaseConfig);

const usersRef = firebase.database().ref("users/");

const middleware = require("./middleware");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 3001;

app.use('/css', express.static(__dirname + '/../public/css'));
app.use('/js', express.static(__dirname + '/../public/js'));
app.use('/fonts', express.static(__dirname + '/../public/fonts'));
app.use('/uploads', express.static(__dirname + '/../public/uploads'));

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

app.get('/', [
        middleware.authenticate,
        middleware.info,
        middleware.getuserlist
    ], (req, res) => {
    res.render('index.hbs', {
        userList: req.userList,
        currentUser: req.currentUser,
        title: "Messenger | Home"
    }); 
});

app.get('/test', (req, res) => {
    res.render('test.hbs');
});

app.get('/messengers/:id', [   
        middleware.authenticate,
        middleware.info,
        middleware.gettargetuser,
        middleware.getuserlist,
        middleware.getmessagelist
    ], (req, res) => {
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
    socket.on('join', (information) => {
        var {room, currentUserId} = information;

        if (socket.room) {
            socket.leave(socket.room);
        }
        
        socket.room = room;
        console.log(currentUserId + " joined " + socket.room);

        conversationId = room;

        var conversationRef = firebase.database().ref(conversationId);

        conversationRef.endAt().limitToLast(1).on('child_added', (childSnapshot) => {
            if (childSnapshot.val().recipient === currentUserId) {
                socket.emit("newMessage", childSnapshot.val());
            }
        });

        socket.join(socket.room);
    });

    socket.on('createMessage', (newEmail) => {
        console.log('createMessage');
        var newMessage = {
            sender: newEmail.sender,
            recipient: newEmail.recipient,
            message: newEmail.message
        };

        var conversationRef = firebase.database().ref(conversationId);

        var newMessRef = conversationRef.push(newMessage);
        conversationRef.child(newMessRef.key).set(newMessage);

        // socket.broadcast.to(conversationId).emit("newMessage", newMessage);
        conversationRef.child(newMessRef.key).on("child_added", (snapshot) => {
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

    usersRef.child(uid).update({ 
        idToken,
        connection: 'online'
    })
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

app.post('/info', [middleware.authenticate], (req, res) => {
    var displayName = req.body.name;
    usersRef.child(req.currentUser.uid).update({ displayName })
        .then(() => {
            res.redirect('/');
        })
        .catch((e) => {
            res.redirect('/info');
        })
});

app.post('/register', (req, res) => {
    const newUser = {
        email: req.body.email,
        idToken: req.cookies.token,
        displayName: null,
        createdAt: new Date().getTime(),
        connection: "online"
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
                    console.log(e);
                    res.redirect('/register');
                });
        }
    });
});

app.get('/logout', [middleware.authenticate], (req, res) => {
    res.clearCookie('token');
    usersRef.child(req.currentUser.uid).update({ 
        idToken: null,
        connection: 'offline'
    })
        .then((user) => {
            res.redirect('/login');
        })
        .catch((e) => {
            res.redirect('/login');
        })
});

server.listen(port, () => {
    console.log(`Started on port ${port}`);
});
