'use strict';

var winston = require('winston');
var sluggish = require('sluggish');
var validator = require('validator');
var markupService = require('../../../services/markup');
var summaryService = require('../../../services/summary');
var bioService = require('../../../services/bio');
var User = require('../../../models/User');
var rprotocol = /^https?:\/\//i;
var rtwitter = /^https?:\/\/twitter\.com\//i;
var rtwitter_legacy = /[@#!]+/i;

module.exports = function (req, res, next) {
  var body = req.body;
  var bio = validator.toString(body.bio);
  var bioHtml = markupService.compile(bio, { deferImages: true });
  var bioText = summaryService.summarize(bioHtml, 200).text;

  User.findOne({ _id: req.user }, update);

  function update (err, user) {
    if (err) {
      next(err); return;
    }
    if (!user) {
      res.status(404).json({ messages: ['Account not found!'] }); return;
    }
    var displayName = body.displayName;
    if (displayName.length < 4) {
      res.status(400).json({ messages: ['Your name must be at least 4 characters long.'] }); return;
    }
    var slug = sluggish(body.slug);
    if (slug.length < 4) {
      res.status(400).json({ messages: ['Your username must be at least 4 characters long.'] }); return;
    }
    var validEmail = validator.isEmail(body.email);
    if (!validEmail) {
      res.status(400).json({ messages: ['Use a valid email address.'] }); return;
    }
    user.email = body.email;
    user.displayName = displayName;
    user.slug = slug;
    user.twitter = parseTwitter(body.twitter);
    user.website = parseLink(body.website);
    user.avatar = parseLink(body.avatar);
    user.bio = bio;
    user.bioHtml = bioHtml;
    user.bioText = bioText;

    var password = validator.toString(body.password);
    if ('password' in body && 'oldPassword' in body) {
      if (password.length < 4) {
        res.status(400).json({ messages: ['The password must be at least 4 characters long.'] }); return;
      }
      user.validatePassword(body.oldPassword, validatedPassword);
    } else {
      save();
    }
    function validatedPassword (err, valid) {
      if (err) {
        next(err); return;
      }
      user.password = password;
      save();
    }
    function save () {
      user.save(saved);
    }
  }

  function parseTwitter (value) {
    if (!value) {
      return null;
    }
    return value
      .replace(rtwitter, '')
      .replace(rtwitter_legacy, '');
  }

  function parseLink (value) {
    if (!value) {
      return null;
    }
    if (!rprotocol.test(value)) {
      return 'http://' + value;
    }
    return value;
  }

  function saved (err, user) {
    if (err) {
      next(err); return;
    }
    bioService.update(user.email, bio, bioHtml, bioText);
    res.json({});
  }
};
