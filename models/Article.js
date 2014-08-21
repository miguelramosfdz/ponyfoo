'use strict';

var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;
var schema = new mongoose.Schema({
  author: { type: ObjectId, index: { unique: false }, require: true, ref: 'User' },
  created: { type: Date, index: { unique: false }, require: true, 'default': Date.now },
  updated: { type: Date, require: true, 'default': Date.now },
  publication: { type: Date, require: false },
  status: { type: String, require: true },
  title: String,
  slug: { type: String, index: { unique: true }, require: true },
  sign: String,
  introduction: String,
  introductionHtml: String,
  body: String,
  bodyHtml: String,
  tags: [String],
  prev: { type: ObjectId, index: { unique: false }, ref: 'Article' },
  next: { type: ObjectId, index: { unique: false }, ref: 'Article' },
  related: [{ type: ObjectId, ref: 'Article' }],
  comments: [{ type: ObjectId, ref: 'Comment' }]
}, { id: false, toObject: { getters: true }, toJSON: { getters: true } });

var api = mongoose.model('Article', schema);

api.validStatuses = ['draft', 'publish', 'published'];
api.schema = schema;

module.exports = api;
