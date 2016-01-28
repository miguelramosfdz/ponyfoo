'use strict';

var markupService = require('../../services/markup');
var cryptoService = require('../../services/crypto');
var feedService = require('../../services/feed');
var sitemapService = require('../../services/sitemap');
var articleService = require('../../services/article');
var articleSearchService = require('../../services/articleSearch');
var Article = require('../Article');
var env = require('../../lib/env');

Article.schema.pre('save', beforeSave);
Article.schema.post('save', afterSave);

function computeSignature (a) {
  return cryptoService.md5([a.title, a.status, a.teaser, a.introduction, a.body].concat(a.tags).join(' '));
}

function beforeSave (next) {
  var bulk = env('BULK_INSERT');
  var article = this;
  var oldSign = article.sign;

  article.sign = computeSignature(article);
  article.teaserHtml = toHtml(article.teaser, 1);
  article.introductionHtml = toHtml(article.introduction, 1);
  article.bodyHtml = toHtml(article.body, true);
  var summary = articleService.summarize(article);
  article.summaryText = summary.text;
  article.summaryHtml = summary.html;
  article.updated = Date.now();

  if (!bulk && oldSign !== article.sign && article.status === 'published') {
    articleSearchService.addRelated(article, next);
  } else {
    next();
  }
}

function toHtml (md, i) {
  return markupService.compile(md, { deferImages: i });
}

function afterSave () {
  var bulk = env('BULK_INSERT');
  if (bulk) { // trust that these will be rebuilt afterwards
    return;
  }
  feedService.rebuild();
  sitemapService.rebuild();
}

module.exports = Article;
