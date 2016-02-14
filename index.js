/*!
 * grunt-assemble-lunr <git://github.com/assemble/grunt-assemble-lunr.git>
 *
 * Copyright (c) 2014-2015, Brian Woodward.
 * Licensed under the MIT License.
 */

// node libs
var path = require('path');
var fs = require('fs');

// external libs
var cheerio = require('cheerio');
var lunr = require('lunr');
var _ = require('lodash');


var idx = lunr(function() {
  this.ref('url');
  this.field('title', { boost: 10 });
  this.field('tags', { boost: 100 });
  this.field('body');
});

var cache = {},
    searchCache = {};

var addCacheItem = function(page) {
  cache[page.dest] = {
    url: page.dest,
    title: page.title || page.dest,
    tags: (page.tags || []).join(' '),
    body: ''
  };
  searchCache[page.dest] = {
    fullUrl: page.dest,
    url: page.filename,
    title: page.title || page.dest,
    tags: (page.tags || []).join(' ')
  }
};

var updateCacheItem = function(page, content) {
  var $ = cheerio.load(content);
  cache[page.dest].body = $('body').text();
};

var options = {
  stage: 'render:*:*'
};


/**
 * Lunr Search Plugin
 * @param  {Object}   params
 * @param  {Function} callback
 */
module.exports = function(params, callback) {
  'use strict';

  var opts = params.assemble.options;
  opts.lunr = opts.lunr || {
    dataPath: path.join(process.cwd(), 'search_index.json'),
    searchDataPath: path.join(process.cwd(), 'search_data.json')
  };

  // call before each page is rendered to get
  // information from the context
  var gatherSearchInformation = function () {
    addCacheItem(params.context.page);
    params.context.lunr = params.context.lunr || {};
    params.context.lunr.dataPath = params.context.lunr.dataPath || 'search_index.json';
  };

  var indexPageContent = function () {
    updateCacheItem(params.page, params.content);
  };

  var generateSearchDataFile = function () {
    _.forOwn(cache, function(item, url) {
      idx.add(item);
    });

    fs.writeFileSync(opts.lunr.dataPath, JSON.stringify(idx));
    fs.writeFileSync(opts.lunr.searchDataPath, JSON.stringify(searchCache));
  };

  switch(params.stage) {

    // for each page, gather search data and add path of
    // index file to context
    case 'render:pre:page':
      gatherSearchInformation();
      break;


    // get the rendered data for each page and add to search
    // data index file.
    case 'render:post:page':
      indexPageContent();
      break;

    // after rendering all the pages
    // build up the final search data index file
    case 'render:post:pages':
      generateSearchDataFile();
      break;

    default:
      break;
  }

  callback();
};

module.exports.options = options;
