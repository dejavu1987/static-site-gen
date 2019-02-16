/**
 * Static Site Generator Class
 *
 * @author anil.maharjan@inviqa.com
 */

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const Spider = require('node-spider');
const {performance, PerformanceObserver} = require('perf_hooks');
const Jetty = require("jetty");


/**
 * SSG class
 */
class SSG {
  constructor(spiderConfig, config) {
    this.spiderConfig = spiderConfig;
    this.spider = new Spider({
      ...this.spiderConfig,
      error: (err, url) => {
        console.error(err, url);
      },
      done: () => {
        this.jetty.moveTo([this.ROW.success, 3]).rgb(150).text('Successfully generated static site!');
        this.jetty.moveTo([this.ROW.success + 4, 3]).rgb(6).text(`File counts by type:`);
        let typeCountStr =Object.keys(this.typeCounts).sort((a, b) => this.typeCounts[a] - this.typeCounts[b]).map(type => type + '\t -> \t' + this.typeCounts[type]).join('\n\t');
        this.jetty.moveTo([this.ROW.success + 5, 3]).rgb(6).text('----------------------------------\n\t'+ typeCountStr);

        performance.mark('B');
        performance.measure('A to B', 'A', 'B');
      },
    });
    this.STATIC_DIR = 'static/' + config.STATIC_DIR;
    this.TARGET_HOST = config.TARGET_HOST;
    this.ROW = config.ROW;
    this.jetty = new Jetty(process.stdout);
    this.fileCount = 0;
    this.args = config.args;
    this.typeCounts = {};

    this.obs = new PerformanceObserver((items) => {
      this.jetty.moveTo([this.ROW.success + 2, 3])
        .rgb(150)
        .text(`Time to all queries: ${(items.getEntries()[0].duration / 1000).toFixed(2)} sec`).moveTo([this.ROW.success + 20, 0]);
      performance.clearMarks();
    });
    this.obs.observe({ entryTypes: ['measure'] });
  }

  init() {
    performance.mark('A'); // Mark A for perf check
    this.jetty.clear();
    this.jetty.moveTo([this.ROW.intro, 0])
      .text('=========================================================\n' +
        '\tINVIQA Static Site Generator\n' +
        '=========================================================');


    this.jetty.moveTo([this.ROW.config, 3])
      .rgb(150)
      .text(`Configs: ${JSON.stringify(this.args)}`);
    // Clean up static folder before starting the crawler
    rimraf(`./${this.STATIC_DIR}`, () => {
      this.jetty.moveTo([this.ROW.folder, 5]).text('🗑  Static folder deleted!');
      // performance.mark('B');


      // start crawling
      this.jetty.moveTo([this.ROW.crawl, 5])
        .text('🕷  Started Crawling Index page!');
      this.spider.queue(`http://${this.TARGET_HOST}`, (doc) => this.handleRequest(doc));
    });
  }

  /**
   * Processes file path
   * - adds index.html if needed
   * - modifies file name to accomodate query strings
   * @param doc
   * @returns {string}
   */
  processFilePath(doc) {
    // Place everything within a folder this.STATIC_DIR
    let filePath = `./${this.STATIC_DIR}${decodeURIComponent(doc.res.req.path)}`;


    if (filePath.match(/\?.+$/) && doc.res.headers['content-type'].match('text/html')) { // If query string present remove from filename
      filePath = filePath.replace(/\?(.+)=(.+)$/, '--$1--$2');
    } else {
      if (filePath.match(/\?.+$/)) {
        filePath = filePath.replace(/\?.+$/, '');
      }
    }

    // in no fileextension
    if (!filePath.match(/.\.(html)(\?.+)?$/) && doc.res.headers['content-type'].match('text/html')) {
      filePath += "/index.html"
    }
    // squeeze double slashes
    return filePath.replace(/\/\//, "/");
  }

  /**
   * Write file to static folder
   * @param filePath
   * @param doc
   */
  writeFile(filePath, doc) {
    fs.writeFile(filePath, doc.res.body, (err) => {
      if (err) {
        return console.log(err);
      }
      this.jetty.moveTo([this.ROW.file, 5])
        .rgb(82, false)
        .erase(100)
        .moveTo([this.ROW.file, 5])
        .text(`💾 Last saved: ${filePath}`);
      this.jetty.moveTo([this.ROW.fileCount, 5])
        .erase(40).rgb(9, false)
        .moveTo([this.ROW.fileCount, 5])
        .text(`🗂  Total file count: ${this.fileCount++}`).moveTo([this.ROW.success + 20, 0]);
    });
  }

  /**/
  scrapeContent(doc) {
    // scrape CSS files from @imports
    doc.$('style').toArray()
      .map(style => doc.$(style).text())
      .filter(style => style.match('@import'))
      .forEach((style) => {
      const regEx = /url\("(.*)"\)/g;
      let matches;
      while (matches = regEx.exec(style)) {
        this.queue(matches[1].replace(/(\?.+)$/, ''), doc);
      }
    });

    // Scrape linked html files and css files
    doc.$('a, link').toArray()
      .sort(() => Math.random() - 0.5)
      .forEach((elem) => {
        // do stuff with element
        let href = doc.$(elem).attr('href');
        if (href) {
          this.queue(href.split('#')[0], doc);
        }
      });

    // Scrape images and JS
    let images = doc.$('script, img').toArray()
      .sort(() => Math.random() - 0.5)
      .forEach((elem) => {
        // do stuff with element
        let uri = doc.$(elem).attr('src');
        if (uri) {
          this.queue(uri.replace(/(\?.+)$/, ''), doc);
        }
      });
  }

  queue(uri, doc) {
    const url = doc.resolve(uri);
    if (url.match(/^https?:\/\//) && url.match(this.TARGET_HOST)) {
      this.spider.queue(url, (doc) => this.handleRequest(doc));
    }
  }

  handleRequest(doc) {
    // if the host is not same as this.TARGET_HOST dont do anything
    if (doc.res.request.host != this.TARGET_HOST.split(':')[0])
      return;

    const filePath = this.processFilePath(doc);

    // Create parents if dirs doesnt exist
    SSG.ensureDirectoryExistence(filePath);
    // Write the file
    this.writeFile(filePath, doc);
    const contentType = doc.res.headers['content-type'];
    const contentTypeShortMatch = contentType.match(/(.+);/);
    const contentTypeShort = contentTypeShortMatch ? contentTypeShortMatch[1] : contentType;
    this.typeCounts[contentTypeShort] = this.typeCounts.hasOwnProperty(contentTypeShort) ? this.typeCounts[contentTypeShort] + 1 : 1;
    // Scrape if the document is an HTML
    if (contentType.match('text/html')) {
      this.scrapeContent(doc);
    }
  }

  static ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    this.ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
  }


}

module.exports.SSG = SSG;
