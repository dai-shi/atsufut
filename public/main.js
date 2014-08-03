/*
 * Copyright (C) 2014, Daishi Kato <daishi@axlight.com>
 * All rights reserved.
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

angular.module('MainModule').controller('MainController', ['$scope', '$famous',
  function($scope, $famous) {

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
      restitution: 0.4
    });
    var force = new Force([0, 0.0007, 0]);

    var RADIUS = 20;

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
      return circle;
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
        strength: 2,
        decayFunction: Repulsion.DECAY_FUNCTIONS.INVERSE
      });
      repulsion.applyForce($scope.circles);
    }

    $scope.clickBody = function(e) {
      if (!$scope.ready || $scope.show_message) return;
      var posX = e.x || e.clientX || e.detail && e.detail.clientX;
      var posY = e.y || e.clientY || e.detail && e.detail.clientY;
      var relX = posX - $scope.windowWidth / 2;
      if (posY < $scope.windowHeight / 2) {
        createCircle(relX);
        $scope.sendMessage({
          action: 'create',
          x: relX
        });
      } else {
        repulseCircles(relX);
        $scope.sendMessage({
          action: 'repulse',
          x: relX
        });
      }
    };

    function handleRemoteMessage(event, data) {
      if (!$scope.ready || $scope.show_message) return;
      $scope.$apply(function() {
        if (data.action === 'create') {
          createCircle(data.x);
        } else if (data.action === 'repulse') {
          repulseCircles(data.x);
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

    //TODO: loading icon
    //TODO: sound
    //BUG: resize does not work
  }
]);

angular.module('MainModule').directive('myTouchstart', ['$swipe',
  function($swipe) {
    return {
      scope: {
        myTouchstart: '='
      },
      link: function(scope, element) {
        $swipe.bind(element, {
          start: function(event) {
            scope.$apply(function() {
              scope.myTouchstart(event);
            });
          }
        });
      }
    };
  }
]);
