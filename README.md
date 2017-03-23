# Messenger Web Client
A Messenger App using NodeJS, Firebase and SocketIO.

### Installation
  ```
    git clone git@github.com:bkdev98/messenger-web-client.git
    cd messenger-web-client
    npm install
    create a new firebase app, edit file server/config/firebase.json like
    
    {
      "apiKey": "ABC123",
      "authDomain": "xyz.firebaseapp.com",
      "databaseURL": "https://xyz.firebaseio.com",
      "storageBucket": "xyz.appspot.com",
      "messagingSenderId": "123"
    }
    
    enable sign-in method using Email and Google in your Firebase console, add these lines to Database Rules
    
    {
      "rules": {
        ".read": true,
        ".write": true,
        "users": {
          ".indexOn": ["idToken"]
        },
        "conversation": {
          ".indexOn": ".value"
        },
        "messages": {
          ".indexOn": ["conversationId"]
        }
      }
    }
    
    npm start
  ```
