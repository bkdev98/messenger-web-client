var socket = io();
console.log(conversationId);
socket.on('connect', function () {
  console.log('Connected to server');

  socket.emit('join', function (err) {
    if (err) {
      console.log(err);
    } else {
      
    }
  });

  socket.on('newMessage', function (message) {
    var templateResponse = Handlebars.compile($("#message-response-template").html());
    var contextResponse = {
      response: message.content,
      time: message.createdAt
    };
    chat.$chatHistoryList.append(templateResponse(contextResponse));
    chat.scrollToBottom();

    // var contextResponse = {
    //   response: message.content,
    //   time: message.createdAt
    // };

    // chat.$chatHistoryList.append('<li><div class="message-data"><span class="message-data-name"><i class="fa fa-circle online"></i>hello</span><span class="message-data-time">' + contextResponse.time + '</span></div><div class="message my-message">' + contextResponse.response + '</div></li>');
    // chat.scrollToBottom();
    console.log(contextResponse);
  });
});

socket.on('disconnect', function () {
  console.log('Disconnected to server');
});

var chat = {
  messageToSend: '',
  init: function () {
    this.cacheDOM();
    this.bindEvents();
    this.render();
  },
  emitCreateMessage: function (content) {
    socket.to(conversationId).emit('createMessage', {
        content
    });
  },
  cacheDOM: function () {
    this.$chatHistory = $('.chat-history');
    this.$button = $('button');
    this.$textarea = $('#message-to-send');
    this.$chatHistoryList = this.$chatHistory.find('ul');
  },
  bindEvents: function () {
    this.$button.on('click', this.addMessage.bind(this));
    this.$textarea.on('keyup', this.addMessageEnter.bind(this));
  },
  render: function () {
    this.scrollToBottom();
    if (this.messageToSend.trim() !== '') {
      var template = Handlebars.compile($("#message-template").html());
      var context = {
        messageOutput: this.messageToSend,
        time: new Date().getTime()
      };

      this.$chatHistoryList.append(template(context));
      this.scrollToBottom();
      console.log('render');
      this.$textarea.val('');
    }
  },
  addMessage: function () {
    this.messageToSend = this.$textarea.val();
    this.emitCreateMessage(this.messageToSend);
    this.render();
  },
  addMessageEnter: function (event) {
    // enter was pressed
    if (event.keyCode === 13) {
      this.addMessage();
    }
  },
  scrollToBottom: function () {
    this.$chatHistory.scrollTop(this.$chatHistory[0].scrollHeight);
  },
  getRandomItem: function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
};

chat.init();

var searchFilter = {
  options: {
    valueNames: ['name']
  },
  init: function () {
    var userList = new List('people-list', this.options);
    var noItems = $('<li id="no-items-found">No items found</li>');

    userList.on('updated', function (list) {
      if (list.matchingItems.length === 0) {
        $(list.list).append(noItems);
      } else {
        noItems.detach();
      }
    });
  }
};

searchFilter.init();