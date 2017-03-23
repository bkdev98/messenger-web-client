const firebase = require('firebase');

const messagesRef = firebase.database().ref("messages/");
const usersRef = firebase.database().ref("users/");
const conversationRef = firebase.database().ref("conversation/");

module.exports = {
    authenticate: (req, res, next) => {
        var token = req.cookies.token;
        if (token) {
            usersRef.orderByChild("idToken").equalTo(token).once("value", (snapshot) => {
                var uid = Object.keys(snapshot.val())[0];
                user = {
                    uid,
                    email: snapshot.val()[uid].email,
                    fullname: snapshot.val()[uid].fullname
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
            if (snapshot.val().fullname !== null) {
                next();
            } else {
                res.redirect('/info');
            }
        }, (e) => {
            res.redirect('/login');
        })
    },
    gettargetuser: (req, res, next) => {
        var targetUser = {};
        var id = req.params.id;

        usersRef.orderByKey().equalTo(id).once("value", (snapshot) => {
            if (!snapshot) {
                res.redirect('/');
            } else {
                req.targetUser = snapshot.val()[id];
                if (!req.targetUser.avatar) {
                    req.targetUser = 'user.png'
                };
                next();
            }
        });
    },
    getuserlist: (req, res, next) => {
        var userList = [];
        usersRef.once('value', (snapshot) => {
            Object.keys(snapshot.val()).map((key) => {
                var { email, fullname, avatar } = snapshot.val()[key];
                if (!avatar) {
                    avatar = 'user.png'
                };
                var user = {
                    email,
                    fullname,
                    uid: key,
                    avatar
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
        targetUserId = req.params.id;
        currentUserId = req.currentUser.uid;
        var conversationId = null;
        var messageList = [];

        conversationRef.orderByChild(currentUserId).equalTo(targetUserId).once("value", (snapshot) => {
            if (snapshot.val() !== null) {
                conversationId = Object.keys(snapshot.val())[0];
                //  GET messages
                return messagesRef.once('value').then((snapshot) => {
                    var messages = snapshot.val() || {};
                    
                    Object.keys(messages).forEach((key) => {
                        if (messages[key].conversationId === conversationId) {
                            messageList.push(messages[key]);
                        }
                    });
                    // console.log('mess 1', messageList);
                    req.messageList = messageList;
                    req.conversationId = conversationId;
                    next();
                });
            } else {
                conversationRef.orderByChild(targetUserId).equalTo(currentUserId).once("value", (snapshot) => {
                    if (snapshot.val() !== null) {
                        conversationId = Object.keys(snapshot.val())[0];
                        // console.log('conver', conversationId);
                        //  GET messages
                        return messagesRef.once("value").then((snapshot) => {
                            var messages = snapshot.val() || {};
                            
                            Object.keys(messages).forEach((key) => {
                                if (messages[key].conversationId === conversationId) {
                                    messageList.push(messages[key]);
                                }
                            });
                            // console.log('mess 2', messageList);
                            req.messageList = messageList;
                            req.conversationId = conversationId;
                            next();
                        });
                    } else {
                        var newConver = {};
                        newConver[currentUserId] = targetUserId;

                        var newConverRef = conversationRef.push(newConver);
                        conversationId = newConverRef.key;
                        conversationRef.child(conversationId).set(newConver)
                            .then(() => {
                                return messagesRef.once("value").then((snapshot) => {
                                    var messages = snapshot.val() || {};
                                    
                                    Object.keys(messages).forEach((key) => {
                                        if (messages[key].conversationId === conversationId) {
                                            messageList.push(messages[key]);
                                        }
                                    });
                                    // console.log('mess 3', messageList);
                                    req.messageList = messageList;
                                    req.conversationId = conversationId;
                                    next();
                                });
                            });
                    }
                });
            }
        });

    }
}