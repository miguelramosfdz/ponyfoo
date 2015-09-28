'use strict';

var $ = require('dominus');
var taunus = require('taunus');
var moment = require('moment');
var fonts = require('./fonts');
var markdownService = require('../../services/markdown');
var subscriptions = require('./subscriptions');
var conventions = require('./conventions');
var analytics = require('./analytics');
var wiring = require('./wiring');
var main = $.findOne('.ly-main');
var g = global;

require('hint');
require('./lib/codepen');

conventions();
require('./conventions/textareas')()
require('./conventions/konami')()
fonts();

taunus.on('start', starting);
taunus.mount(main, wiring, { bootstrap: 'manual', forms: false });

g.$ = $;
g.md = markdownService.compile;
g.moment = moment;

setTimeout(helpMePay, 7000);

function starting (container, viewModel) {
  require('./search');
  subscriptions($('.de-subscribe'));
  analytics(viewModel.env);
  require('./welcome')(viewModel);
}

function helpMePay () {
  var ad = $('#carbonads').length !== 0;
  if (ad === false) {
    $('.ca-help-me').removeClass('uv-hidden');
  }
}
