'use strict';

var fs = require('fs');
var util = require('util');
var contra = require('contra');
var cheerio = require('cheerio');
var inlineCss = require('inline-css');
var feedService = require('./feed');
var markupService = require('./markup');
var weeklyService = require('./weekly');
var WeeklyIssue = require('../models/WeeklyIssue');
var env = require('../lib/env');
var authority = env('AUTHORITY');
var css = fs.readFileSync('.bin/static/newsletter-rss.css', 'utf8');

function getFeed (done) {
  WeeklyIssue
    .find({ status: 'released', statusReach: 'everyone' })
    .populate('author', 'displayName email')
    .sort('-publication')
    .limit(20)
    .exec(found);

  function found (err, issues) {
    if (err) {
      done(err); return;
    }

    contra.map(issues, toFeedItem, done);
    function toFeedItem (issue, next) {
      formatContent(md(issue.summaryHtml) + issue.contentHtml, formatted);
      function formatted (err, description) {
        if (err) {
          next(err); return;
        }
        next(null, {
          title: issue.computedTitle + ' \u2014 Pony Foo Weekly',
          url: authority + '/weekly/' + issue.slug,
          description: description,
          categories: weeklyService.getAllTags(issue),
          author: util.format('%s <%s>', issue.author.displayName, issue.author.email),
          date: issue.publication
        });
      }
    }
    function md (html) {
      return '<div class="md-markdown">' + html + '</div>';
    }
    function formatContent (contentHtml, done) {
      var compilerOpts = {
        markdown: false,
        absolutize: true,
        removeEmoji: true
      };
      var inliningOpts = {
        extraCss: css,
        url: authority
      };
      var contents = '<div class="f-core">' + contentHtml + '</div>';
      var fixed = markupService.compile(contents, compilerOpts);

      inlineCss(fixed, inliningOpts).then(inlinedCss, done);

      function inlinedCss (inlined) {
        var $ = cheerio.load(inlined);
        $('.wy-section-header .md-markdown > p').each(replaceWith($, 'div'));
        var html = $.html();
        done(null, html);
      }
      function replaceWith ($, tagName) {
        var tag = '<' + tagName + '>';
        return replacer;
        function replacer () {
          var el = $(this);
          var contents = el.html();
          var replacement = $(tag).html(contents);
          el.replaceWith(replacement);
        }
      }
    }
  }
}

module.exports = feedService.from({
  id: 'weekly',
  href: '/weekly/feed',
  title: 'Pony Foo Weekly',
  description: 'Latest Pony Foo Weekly issues',
  getFeed: getFeed
});
