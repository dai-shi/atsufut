/*
  Copyright (C) 2014, Daishi Kato <daishi@axlight.com>
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
  A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
  HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
  SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/* global angular: false, io: false */

angular.module('MainModule', ['famous.angular', 'ngTouch']);

angular.module('MainModule').run(['$rootScope', '$window', '$location',
  function($rootScope, $window, $location) {

    $rootScope.windowWidth = $window.innerWidth;
    $rootScope.windowHeight = $window.innerHeight;
    $window.addEventListener('resize', function() {
      $rootScope.$apply(function() {
        $rootScope.windowWidth = $window.innerWidth;
        $rootScope.windowHeight = $window.innerHeight;
      });
    });

    var socket = io.connect($location.absUrl());
    socket.on('message', function(data) {
      $rootScope.$broadcast('handleRemoteMessage', data);
    });
    $rootScope.sendMessage = function(data) {
      socket.emit('message', data);
    };

  }
]);

angular.module('MainModule').controller('MainController', ['$scope', '$famous', '$window',
  function($scope, $famous, $window) {

    var Engine = $famous['famous/core/Engine'];
    var PhysicsEngine = $famous['famous/physics/PhysicsEngine'];
    var Walls = $famous['famous/physics/constraints/Walls'];
    var Collision = $famous['famous/physics/constraints/Collision'];
    var Force = $famous['famous/physics/forces/Force'];
    var Repulsion = $famous['famous/physics/forces/Repulsion'];
    var Circle = $famous['famous/physics/bodies/Circle'];

    var physicsEngine = new PhysicsEngine();
    var walls = new Walls({
      sides: [Walls.SIDES.LEFT, Walls.SIDES.RIGHT, Walls.SIDES.BOTTOM]
    });
    for (var key in walls.components) {
      walls.components[key].setOptions({
        restitution: 0.01
      });
    }
    var collision = new Collision({
      restitution: 0.2
    });
    var force = new Force([0, 0.0007, 0]);

    var RADIUS = 20;

    var sound01 = $window.document.getElementById('sound01');
    var sound02 = $window.document.getElementById('sound02');

    $scope.fingers = {};
    var fingerKey = Math.floor(Math.random() * 256);
    var fingerWidth = 60;
    var fingerHeight = 90;

    function updateFinger(key, x, top) {
      if (x < -$scope.windowWidth / 2 + fingerWidth / 2) {
        x = -$scope.windowWidth / 2 + fingerWidth / 2;
      }
      if (x > $scope.windowWidth / 2 - fingerWidth / 2) {
        x = $scope.windowWidth / 2 - fingerWidth / 2;
      }
      var pos;
      if (top) {
        pos = [x, -$scope.windowHeight / 2 + fingerHeight / 2, 100];
      } else {
        pos = [x, $scope.windowHeight / 2, 100];
      }
      $scope.fingers[key] = {
        key: key,
        position: pos
      };
    }

    $scope.circles = [];

    function createCircle(x) {
      if (x < -$scope.windowWidth / 2 + RADIUS) {
        x = -$scope.windowWidth / 2 + RADIUS;
      }
      if (x > $scope.windowWidth / 2 - RADIUS) {
        x = $scope.windowWidth / 2 - RADIUS;
      }

      var circle = new Circle({
        radius: RADIUS
      });
      circle.setPosition([x + Math.random() - 0.5, -2 * RADIUS - $scope.windowHeight / 2 + 1]);
      physicsEngine.addBody(circle);
      // workaround for physicsEngine.attach(walls, circle);
      // see famous/physics #12
      for (var key in walls.components) {
        physicsEngine.attach(walls.components[key], circle);
      }
      physicsEngine.attach(force, circle);
      physicsEngine.attach(collision, $scope.circles.slice(0), circle);
      circle.created_at = Date.now();
      circle.rare1 = Math.random() < 0.01;
      $scope.circles.push(circle);
      try {
        if (!sound01.ended) {
          sound01.pause();
          sound01.currentTime = 0;
        }
        sound01.play();
      } catch (e) {}
    }

    function deleteCircle(circle) {
      physicsEngine.removeBody(circle);
      var idx = $scope.circles.indexOf(circle);
      $scope.circles.splice(idx, 1);
    }

    function repulseCircles(x) {
      if (x < -$scope.windowWidth / 2) {
        x = -$scope.windowWidth / 2;
      }
      if (x > $scope.windowWidth / 2) {
        x = $scope.windowWidth / 2;
      }

      var repulsion = new Repulsion({
        anchor: [x, $scope.windowHeight / 2],
        strength: 3.5,
        decayFunction: Repulsion.DECAY_FUNCTIONS.INVERSE
      });
      repulsion.applyForce($scope.circles);
      try {
        if (!sound02.ended) {
          sound02.pause();
          sound02.currentTime = 0;
        }
        sound02.play();
      } catch (e) {}
    }

    var lastRepluseTime = 0;
    $scope.clickBody = function(e) {
      if (!$scope.ready || $scope.show_message) return;
      var now = Date.now();
      var posX = e.x || e.clientX || e.detail && e.detail.clientX;
      var posY = e.y || e.clientY || e.detail && e.detail.clientY;
      var relX = posX - $scope.windowWidth / 2;
      if (posY < $scope.windowHeight / 2) {
        createCircle(relX);
        updateFinger(fingerKey, relX, true);
        $scope.sendMessage({
          action: 'create',
          x: relX,
          key: fingerKey
        });
      } else if (lastRepluseTime + 1000 < now) {
        lastRepluseTime = now;
        repulseCircles(relX);
        updateFinger(fingerKey, relX, false);
        $scope.sendMessage({
          action: 'repulse',
          x: relX,
          key: fingerKey
        });
      }
    };

    $window.addEventListener('devicemotion', function(event) {
      if (Math.abs(event.acceleration.y) < 10) return;
      $scope.$apply(function() {
        var relX = 0;
        createCircle(relX);
        updateFinger(fingerKey, relX, true);
        $scope.sendMessage({
          action: 'create',
          x: relX,
          key: fingerKey
        });
      });
    });

    function handleRemoteMessage(event, data) {
      if (!$scope.ready || $scope.show_message) return;
      $scope.$apply(function() {
        if (data.action === 'create') {
          createCircle(data.x);
          updateFinger(data.key, data.x, true);
        } else if (data.action === 'repulse') {
          repulseCircles(data.x);
          updateFinger(data.key, data.x, false);
        }
      });
    }
    $scope.$on('handleRemoteMessage', handleRemoteMessage);

    $scope.clickCircle = function(c) {
      deleteCircle(c);
    };

    function deleteOutscopeCircles() {
      var len = $scope.circles.length;
      $scope.circles.forEach(function(c) {
        if (c.getPosition()[1] < -2 * RADIUS - $scope.windowHeight / 2) {
          deleteCircle(c);
        }
      });
      if (len > 0 && $scope.circles.length === 0) {
        $scope.$apply(function() {
          $scope.show_message = 'クリア！';
        });
      }
    }

    Engine.on('prerender', function() {
      deleteOutscopeCircles();
    });

    $scope.initialized = true;

    //BUG: resize does not work
  }
]);

angular.module('MainModule').directive('myTouchbegin', ['$swipe',
  function($swipe) {
    return {
      scope: {
        myTouchbegin: '='
      },
      link: function(scope, element) {
        $swipe.bind(element, {
          start: function(event) {
            scope.$apply(function() {
              scope.myTouchbegin(event);
            });
          }
        });
      }
    };
  }
]);

// audio load hack
angular.module('MainModule').run(['$window',
  function($window) {
    var sounds = ['sound01', 'sound02'];
    var loadAudioOnce = function() {
      $window.document.getElementById(sounds.pop()).load();
      if (sounds.length === 0) {
        $window.document.removeEventListener('touchstart', loadAudioOnce, true);
      }
    };
    $window.document.addEventListener('touchstart', loadAudioOnce, true);
  }
]);
