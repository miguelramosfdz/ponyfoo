'use strict';

var pullSubscribers = require('../lib/pullSubscribers');

module.exports = function (req, res, next) {
  pullSubscribers(req, res, function render (err, subscribers) {
    if (err) {
      next('route'); return;
    }

    res.viewModel = {
      model: {
        title: 'Subscribers',
        subscribers: subscribers
      }
    };
    next();
  });
}
