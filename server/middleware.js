const firebase = require('firebase');

const messagesRef = firebase.database().ref("messages/");
const usersRef = firebase.database().ref("users/");
const conversationRef = firebase.database().ref("/");

module.exports = {
    authenticate: (req, res, next) => {
        var token = req.cookies.token;
        if (token) {
            usersRef.orderByChild("idToken").equalTo(token).once("value", (snapshot) => {
                var uid = Object.keys(snapshot.val())[0];
                var avatarId = null;
                if (!snapshot.val()[uid].avatarId) {
                    avatarId = 'user.png'
                } else {
                    avatarId = snapshot.val()[uid].avatarId;
                };
                user = {
                    uid,
                    email: snapshot.val()[uid].email,
                    displayName: snapshot.val()[uid].displayName,
                    avatarId,
                    createdAt: snapshot.val()[uid].createdAt
                }
                req.currentUser = user;
                next();
            }, (e) => {
                res.redirect('/login');
            })
        } else {
            res.redirect('/login');
        }
    },
    info: (req, res, next) => {
        var token = req.cookies.token;

        usersRef.orderByChild("idToken").equalTo(token).once("value", (snapshot) => {
            if (snapshot.val().displayName !== null) {
                next();
            } else {
                res.redirect('/info');
            }
        }, (e) => {
            res.redirect('/login');
        })
    },
    gettargetuser: (req, res, next) => {
        var id = req.params.id;

        usersRef.orderByKey().equalTo(id).once("value", (snapshot) => {
            if (!snapshot) {
                res.redirect('/');
            } else {
                req.targetUser = snapshot.val()[id];
                req.targetUser.uid = id;
                if (!req.targetUser.avatarId) {
                    req.targetUser.avatarId = 'user.png'
                };
                next();
            }
        });
    },
    getuserlist: (req, res, next) => {
        var userList = [];
        usersRef.once('value', (snapshot) => {
            Object.keys(snapshot.val()).map((key) => {
                var { email, displayName, avatarId, connection } = snapshot.val()[key];
                if (!avatarId) {
                    avatarId = 'user.png'
                };
                var user = {
                    email,
                    displayName,
                    uid: key,
                    avatarId,
                    connection
                }
                userList.push(user);
            });
        })
            .then(() => {
                var filteredUserList = [];

                filteredUserList = userList.filter((user) => {
                    return user.uid !== req.currentUser.uid
                });

                req.userList = filteredUserList;
                next();
            })
    },
    getmessagelist: (req, res, next) => {
        if (req.currentUser.createdAt > req.targetUser.createdAt) {
            keyTest = (req.currentUser.email + '-' + req.targetUser.email).replace(/\./g, '-');
        } else {
            keyTest = (req.targetUser.email + '-' + req.currentUser.email).replace(/\./g, '-');
        }

        var messageList = [];

        conversationRef.orderByKey().on("child_added", (snapshot) => {
            if (snapshot.key === keyTest) {
                conversationRef.child(snapshot.key).once("value", snapshot => {
                    var messages = snapshot.val();

                    Object.keys(messages).forEach((key) => {
                        messageList.push(messages[key]);
                    });
                    req.messageList = messageList;
                    req.conversationId = snapshot.key;
                    next();
                });
            }
        });

        if (!req.conversationId) {
            req.messageList = [];
            req.conversationId = keyTest;
            next();    
        }
    }
}
