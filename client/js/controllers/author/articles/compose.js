'use strict';

var $ = require('dominus');
var estimate = require('estimate');
var debounce = require('lodash/function/debounce');
var concurrent = require('contra/concurrent');
var moment = require('moment');
var sluggish = require('sluggish');
var raf = require('raf');
var taunus = require('taunus');
var articleSummarizationService = require('../../../../../services/articleSummarization');
var markdownService = require('../../../../../services/markdown');
var datetimeService = require('../../../../../services/datetime');
var twitterService = require('../../../conventions/twitter');
var userService = require('../../../services/user');
var storage = require('../../../lib/storage');
var loadScript = require('../../../lib/loadScript');
var editorRoles = ['owner', 'editor'];
var defaultStorageKey = 'author-unsaved-draft';
var publicationFormat = 'DD-MM-YYYY HH:mm';
var maxTagSuggestions = 8;

function noop () {}

module.exports = controller;

function controller (viewModel, container, route) {
  concurrent([
    loadScriptUrl('/js/horsey.js'),
    loadScriptUrl('/js/insignia.js'),
    loadScriptUrl('/js/rome.js')
  ], loaded);

  function loaded () {
    initialize(viewModel, container, route);
  }

  function loadScriptUrl (url) {
    return scriptLoader;
    function scriptLoader (next) {
      loadScript(url, next);
    }
  }
}

function initialize (viewModel, container, route) {
  var horsey = global.horsey;
  var insignia = global.insignia;
  var rome = global.rome;
  var article = viewModel.article;
  var editing = viewModel.editing;
  var published = editing && article.status === 'published';
  var title = $('.ac-title');
  var slug = $('.ac-slug');
  var texts = $('.ac-text');
  var heroImage = $('.ac-hero-image');
  var teaser = $('.ac-teaser');
  var editorNote = $('.ac-editor-note');
  var introduction = $('.ac-introduction');
  var body = $('.ac-body');
  var summary = $('.ac-summary');
  var tags = $('.ac-tags');
  var tagsContainer = $.findOne('.ac-tags-container');
  var campaign = $('.ac-campaign');
  var email = $('#ac-campaign-email');
  var tweet = $('#ac-campaign-tweet');
  var fb = $('#ac-campaign-fb');
  var echojs = $('#ac-campaign-echojs');
  var hn = $('#ac-campaign-hn');
  var schedule = $('.ac-schedule');
  var publication = $('.ac-publication');
  var preview = $('.ac-preview');
  var previewHeader = $('.at-header', preview);
  var previewTitle = $('.ac-preview-title');
  var previewTeaser = $('.ac-preview-teaser');
  var previewEditorNote = $('.ac-preview-editor-note');
  var previewIntroduction = $('.ac-preview-introduction');
  var previewBody = $('.ac-preview-body');
  var previewSummary = $.findOne('.ac-preview-summary');
  var previewTags = $.findOne('.ac-preview-tags');
  var previewHtml = $('.ac-preview-html');
  var discardButton = $('.ac-discard');
  var saveButton = $('.ac-save');
  var status = $('.ac-status');
  var statusRadio = {
    draft: $('#ac-draft-radio'),
    publish: $('#ac-publish-radio')
  };
  var boundSlug = true;
  var serializeSlowly = editing ? noop : debounce(serialize, 200);
  var typingTitleSlowly = raf.bind(null, debounce(typingTitle, 100));
  var typingSlugSlowly = raf.bind(null, debounce(typingSlug, 100));
  var typingHeroImageSlowly = raf.bind(null, debounce(typingHeroImage, 100));
  var typingTextSlowly = raf.bind(null, debounce(typingText, 100));
  var typingSummarySlowly = raf.bind(null, debounce(typingSummary, 100));
  var typingTagsSlowly = raf.bind(null, debounce(typingTags, 100));
  var updatePreviewMarkdownSlowly = raf.bind(null, debounce(updatePreviewMarkdown, 300));
  var updatePreviewSummarySlowly = raf.bind(null, debounce(updatePreviewSummary, 300));
  var dateValidator = rome.val.after(moment().endOf('day'));
  var romeOpts = {
    inputFormat: publicationFormat,
    dateValidator: dateValidator,
    timeValidator: timeValidator
  };

  title.on('keypress keydown paste input', typingTitleSlowly);
  slug.on('keypress keydown paste input', typingSlugSlowly);
  heroImage.on('keypress keydown paste input bureaucrat', typingHeroImageSlowly);
  summary.on('keypress keydown paste input', typingSummarySlowly);
  texts.on('keypress keydown paste input', typingTextSlowly);
  tags.on('keypress keydown paste input', typingTagsSlowly);
  discardButton.on('click', discard);
  saveButton.on('click', save);
  status.on('change', updatePublication);
  campaign.on('change', '.ck-input', serializeSlowly);
  schedule.on('change', updatePublication);

  var signet = insignia(tags[0], {
    preventInvalid: true,
    getText: parseTagSlug,
    getValue: parseTagSlug
  });

  horsey(tags[0], {
    source: getTagSuggestions,
    getText: parseTagSlug,
    getValue: parseTagSlug,
    limit: maxTagSuggestions,
    set: addTag,
    appendTo: tagsContainer,
    renderItem: renderHorseyItem
  });

  if (publication.length) {
    rome(publication[0], romeOpts);
  }

  deserialize(editing && article);

  function getCurrentState () {
    return status.where(':checked').text() || 'draft';
  }

  function timeValidator (date) {
    var tf = 'HH:mm:ss';
    var time = moment(moment(date).format(tf), tf);
    return (
       time.isAfter(moment('05:59:59', tf)) &&
      time.isBefore(moment('15:00:00', tf))
    );
  }

  function getTagSuggestions (data, done) {
    var xhrOpts = {
      url: '/api/articles/tags',
      json: true
    };
    taunus.xhr(xhrOpts, done);
  }
  function renderHorseyItem (li, tag) {
    $(li).addClass('ac-tag-item');
    taunus.partial(li, 'author/articles/tag-item', { tag: tag });
  }
  function addTag (tag) {
    signet.addItem(tag);
    updatePreviewSummarySlowly();
  }
  function getTags () {
    return signet.value();
  }
  function parseTagSlug (tag) {
    return typeof tag === 'string' ? tag : tag.slug;
  }
  function updatePublication () {
    serializeSlowly();

    if (published) {
      saveButton.find('.bt-text').text('Save Changes');
      saveButton.parent().attr('aria-label', 'Make your modifications immediately accessible!');
      discardButton.text('Delete Article');
      discardButton.attr('aria-label', 'Permanently delete this article');
      return;
    }
    var state = getCurrentState();
    if (state === 'draft') {
      saveButton.find('.bt-text').text('Save Draft');
      saveButton.parent().attr('aria-label', 'You can access your drafts at any time');
      return;
    }
    var scheduled = schedule.value();
    if (scheduled) {
      saveButton.find('.bt-text').text('Schedule');
      saveButton.parent().attr('aria-label', 'Schedule this article for publication');
      return;
    }
    if (state === 'publish') {
      saveButton.find('.bt-text').text('Publish');
      saveButton.parent().attr('aria-label', 'Make the content immediately accessible!');
    }
  }

  function typingText () {
    serializeSlowly();
    updatePreviewMarkdownSlowly();
  }

  function typingTitle () {
    if (boundSlug) {
      updateSlug();
    }
    updatePreviewTitle();
    serializeSlowly();
  }

  function typingHeroImage () {
    updatePreviewHeroImage();
    serializeSlowly();
  }

  function typingSlug () {
    boundSlug = false;
    serializeSlowly();
  }

  function typingSummary () {
    serializeSlowly();
    updatePreviewSummarySlowly();
  }

  function getHtmlTitle () {
    var rstrip = /^\s*<p>\s*|\s*<\/p>\s*$/ig;
    return getHtml(title).replace(rstrip, '');
  }

  function updatePreviewTitle () {
    previewTitle.html(getHtmlTitle());
    updatePreviewSummarySlowly();
  }

  function updateSlug () {
    slug.value(sluggish(title.value()));
    updatePreviewSummarySlowly();
  }

  function updatePreviewHeroImage () {
    var heroUrl = heroImage.value().trim();
    if (heroUrl) {
      previewHeader.css({ backgroundImage: 'url(\'' + heroUrl + '\')' });
      previewHeader.addClass('at-has-hero');
      previewHeader.removeClass('at-no-hero');
    } else {
      previewHeader.css({ backgroundImage: null });
      previewHeader.removeClass('at-has-hero');
      previewHeader.addClass('at-no-hero');
    }
  }

  function typingTags () {
    updatePreviewSummarySlowly();
    serializeSlowly();
  }

  function updatePreviewMarkdown () {
    var rstrip = /^\s*<p>\s*|\s*<\/p>\s*$/ig;
    previewTeaser.html(getHtml(teaser));
    var note = getHtml(editorNote).replace(rstrip, '');
    if (note.length) {
      previewEditorNote.removeClass('uv-hidden').html(note);
    } else {
      previewEditorNote.addClass('uv-hidden');
    }
    previewIntroduction.html(getHtml(introduction));
    previewBody.html(getHtml(body));
    preview.forEach(twitterService.updateView);
    if (!summary.value()) {
      updatePreviewSummary();
    }
  }

  function updatePreviewSummary () {
    var teaserHtml = getHtml(teaser);
    var editorNoteHtml = getHtml(editorNote);
    var introductionHtml = getHtml(introduction);
    var bodyHtml = getHtml(body);
    var summarized = articleSummarizationService.summarize({
      summary: summary.value(),
      teaserHtml: teaserHtml,
      introductionHtml: introductionHtml
    });
    var parts = [teaserHtml, editorNoteHtml || '', introductionHtml, bodyHtml];
    var readingTime = estimate.text(parts.join(' '));
    var publication = datetimeService.field(moment().add(4, 'days'));
    var article = {
      publication: publication,
      commentCount: 0,
      slug: slug.value(),
      readingTime: readingTime,
      titleHtml: getHtmlTitle(),
      tags: getTags(),
      author: {
        displayName: viewModel.authorDisplayName
      },
      summaryHtml: summarized.html
    };
    var vm = { articles: [article] };
    taunus.partial(previewSummary, 'articles/columns', vm);
  }

  function getHtml (el) { return markdownService.compile(el.value()); }
  function serialize () { storage.set(defaultStorageKey, getRequestData()); }
  function clear () { storage.remove(defaultStorageKey); }

  function deserialize (source) {
    var data = source || storage.get(defaultStorageKey) || {
      email: true, tweet: true, fb: true, echojs: true, hn: true
    };
    var titleText = data.titleMarkdown || '';
    var slugText = data.slug || '';

    title.value(titleText);
    slug.value(slugText);
    heroImage.value(data.heroImage || '');
    teaser.value(data.teaser || '');
    introduction.value(data.introduction || '');
    editorNote.value(data.editorNote || '');
    body.value(data.body || '');
    summary.value(data.summary || '');

    (data.tags || []).forEach(addTag);

    email.value(data.email);
    tweet.value(data.tweet);
    fb.value(data);
    echojs.value(data.echojs);
    hn.value(data.hn);

    boundSlug = sluggish(titleText) === slugText;

    if (data.status !== 'published') {
      statusRadio[data.status || 'publish'].value(true);

      if ('publication' in data) {
        schedule.value(true);
      }
    }

    updatePreviewTitle();
    updatePreviewHeroImage();
    updatePreviewMarkdown();
    updatePublication();
  }

  function getRequestData () {
    var individualTags = getTags();
    var state = published ? article.status : getCurrentState();
    var data = {
      titleMarkdown: title.value(),
      slug: slug.value(),
      summary: summary.value(),
      teaser: teaser.value(),
      editorNote: editorNote.value(),
      introduction: introduction.value(),
      body: body.value(),
      tags: individualTags,
      heroImage: heroImage.value().trim(),
      status: state,
      email: email.value(),
      tweet: tweet.value(),
      fb: fb.value(),
      echojs: echojs.value(),
      hn: hn.value()
    };
    var scheduled = schedule.value();
    if (scheduled && !published) {
      data.publication = moment(publication.value(), publicationFormat).format();
    }
    return data;
  }

  function save () {
    var data = getRequestData();
    send({ json: data });
  }

  function send (data) {
    var req;

    if (editing) {
      req = viewModel.measly.patch('/api/articles/' + route.params.slug, data);
    } else {
      req = viewModel.measly.put('/api/articles', data);
    }
    req.on('data', leave);
  }

  function discard () {
    var name = route.params.slug ? '/articles/' + route.params.slug : 'draft';
    var confirmation = confirm('About to discard ' + name + ', are you sure?');
    if (!confirmation) {
      return;
    }
    if (editing) {
      viewModel.measly.delete('/api/articles/' + route.params.slug).on('data', leave);
    } else {
      leave();
    }
  }

  function leave () {
    clear();
    taunus.navigate('/articles/review');
  }
}
