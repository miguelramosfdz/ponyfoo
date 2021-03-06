'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var campaign = require('campaign');
var assign = require('assignment');
var mailgun = require('campaign-mailgun');
var term = require('campaign-terminal');
var jadum = require('jadum');
var winston = require('winston');
var htmlService = require('./html');
var staticService = require('./static');
var env = require('../lib/env');
var mode = env('EMAIL_MODE');
var from = env('EMAIL_SENDER');
var trap = env('EMAIL_TRAP');
var apiKey = env('MAILGUN_API_KEY');
var authority = env('AUTHORITY');
var cssFile = path.resolve(__dirname, '../.bin/static/email.css');
var css = fs.readFileSync(cssFile, 'utf8');
var layoutFile = '../.bin/views/server/emails/layout.js';
var defaults = {
  authority: authority,
  social: {
    facebook: {
      url: 'https://facebook.com/ponyfoo',
      handle: '@ponyfoo'
    },
    twitter: {
      url: 'https://twitter.com/ponyfoo',
      handle: '@ponyfoo'
    },
    landing: {
      url: 'https://ponyfoo.com',
      name: 'ponyfoo.com'
    }
  },
  styles: { base: css }
};
var api = {
  send: send,
  logger: logger
};
var templateEngine = {
  defaultLayout: layoutFile,
  render: renderTemplate,
  renderString: renderTemplateString
};
var modes = {
  debug: configureDebug,
  trap: configureTrap,
  send: configureSend
};
var client = createClient();

function createClient () {
  var options = configureClient();
  return campaign(options);
}

function configureClient () {
  var brandedHeader = staticService.unroll('/img/banners/branded.png');
  var headerImage = path.join('.bin/public', brandedHeader);
  var defaults = {
    headerImage: headerImage,
    templateEngine: templateEngine,
    formatting: formatting,
    from: from
  };
  if (!modes.hasOwnProperty(mode)) {
    throw new Error('Expected "EMAIL_MODE" environment variable to be one of: "debug", "trap", "send".');
  }
  var configureMode = modes[mode];
  var modeConfiguration = configureMode();
  return assign(defaults, modeConfiguration);
}

function configureDebug () {
  return {
    provider: term()
  };
}

function configureTrap () {
  return {
    trap: trap,
    provider: createSendProvider()
  };
}

function configureSend () {
  return {
    provider: createSendProvider()
  };
}

function createSendProvider () {
  return mailgun({ apiKey: apiKey, authority: authority });
}

function send (type, model, done) {
  var extended = assign({}, defaults, model);
  var template = path.resolve('.bin/views/server/emails', type);
  client.send(template, extended, done || logger);
  api.getLastEmailHtml = getLastEmailHtml;
  function getLastEmailHtml (done) {
    client.render(template, extended, done);
  }
}

function formatting (html) {
  return htmlService.fixedEmojiSize(html);
}

function logger () {
  var args = Array.prototype.slice.call(arguments);
  var err = args.shift(), message;
  if (err) {
    message = util.format('Email sending failed: %s', err.message || '\n' + err.stack);
    winston.error(message, { stack: err.stack || err.message || err || '(unknown)' });
  } else {
    winston.debug('Email sent!');
  }
}
function renderTemplate (file, model, done) {
  done(null, require(file)(model));
}
function renderTemplateString (template, model, done) {
  done(null, jadum.render(template, model));
}

module.exports = api;
