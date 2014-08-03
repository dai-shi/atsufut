/*
 * Copyright (C) 2013, Daishi Kato <daishi@axlight.com>
 * All rights reserved.
 */

var path = require('path');
var http = require('http');
var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var socket_io = require('socket.io');

var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(cookieParser());
app.use(bodyParser.json());

app.get('/', function(req, res) {
  res.render('index');
});

app.get(new RegExp('^/static/(.+)\\.html$'), function(req, res) {
  var view_name = req.params[0];
  res.render(view_name);
});

app.use('/static', express.static(path.join(__dirname, 'public')));

var server = http.createServer(app);
var sio = socket_io(server);
server.listen(process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 5000, process.env.OPENSHIFT_NODEJS_IP, function() {
  console.log('Express server listening.');
});

sio.on('connection', function(socket) {
  socket.on('message', function(data) {
    socket.broadcast.emit('message', data);
  });
});
