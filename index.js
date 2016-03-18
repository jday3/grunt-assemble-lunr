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

var PAGES_DIR = 'src/templates/pages/';

var idx = lunr(function() {
  this.ref('url');
  this.field('title', { boost: 100 });
  this.field('description', { boost: 100 });
  this.field('tags', { boost: 100 });
  this.field('body');
});

var cache = {},
    searchCache = {};

var addCacheItem = function(page, content) {
    var $ = cheerio.load(content);

    $('.article').each(function(index, article){
        var metadata = $(article).find('.anchor')
                                 .contents()
                                 .filter(function(){
                                     return this.type == 'comment'
                                 }),
            anchor = $(article).find('.anchor').first() ? $(article).find('.anchor').first().attr('id') : '',
            pageName = anchor ? page.filename + '#' + anchor : page.dest;
            
        if($(metadata).toArray().length < 1){
            metadata = $(article).contents()
                                 .filter(function(){
                                     return this.type == 'comment'
                                 });
        }

        if($(metadata).toArray().length > 0){
            var data = $(metadata).toArray()[0].data;
            cache[pageName] = {
                url: pageName,
                title: pageName || page.dest,
                tags: (page.tags || []).join(' '),
                body: $(article).text(),
                breadcrumb: page.data.breadcrumb,
                group: getPageGroup(page.src)
            };
            _.forEach(data.split('\n'), function(row){
               if(row && /\w+:/.exec(row)){
                   var propertyName = /\w+:/.exec(row)[0].replace(':',''),
                       propertyValue = row.slice(propertyName.length+2)
                                            .replace(':', '')
                                            .replace('"','')
                                            .replace('\"','')
                                            .replace(',', '')
                                            .trim();
                   cache[pageName][propertyName] = propertyValue;
               } 
            });
        }
    });
};

  
var getPageGroup = function(src){
    return src.substr(src.indexOf(PAGES_DIR) + PAGES_DIR.length).split('/')[0];
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
    params.context.lunr = params.context.lunr || {};
    params.context.lunr.dataPath = params.context.lunr.dataPath || 'search_index.json';
  };

  var indexPageContent = function () {
      if(params.page.data.search !== false){
            console.log('Indexing Search');
            addCacheItem(params.page, params.content);
      }else{
          console.log('Not Indexing Search');
      }
  };

  var generateSearchDataFile = function () {
    _.forOwn(cache, function(item, url) {
      idx.add(item);
    });

    fs.writeFileSync(opts.lunr.dataPath, JSON.stringify(idx));
    fs.writeFileSync(opts.lunr.searchDataPath, JSON.stringify(cache));
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
