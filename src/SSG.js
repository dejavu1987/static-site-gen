/**
 * Static Site Generator Class
 *
 * @author anil.maharjan@inviqa.com
 */

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const Spider = require('node-spider');
// const {performance} = require('perf_hooks');
const Jetty = require("jetty");

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
        this.jetty.moveTo([this.ROW.success+2, 3]).rgb(150).text(`File counts by type:`);
        this.jetty.moveTo([this.ROW.success+3, 3]).rgb(150).text(JSON.stringify(this.typeCounts));
        // this.performance.mark('C');
        // this.performance.measure('A to B', 'A', 'B');
        // const measure = this.performance.getEntriesByName('A to B')[0];
        //
        // this.jetty.moveTo([this.ROW.perf, 3]).rgb(11).text(`Time to delete static: ${(measure.duration / 1000).toFixed(3)} sec`);
        // this.performance.measure('A to C', 'A', 'C');
        // const measure1 = this.performance.getEntriesByName('A to C')[0];
        // this.jetty.moveTo([this.ROW.perf1, 3]).rgb(11).text(`Time to all queries: ${(measure1.duration / 1000).toFixed(2)} sec`);
      },
    });
    this.STATIC_DIR = 'static/'+config.STATIC_DIR;
    this.TARGET_HOST = config.TARGET_HOST;
    this.ROW = config.ROW;
    this.jetty = new Jetty(process.stdout);
    // this.performance = performance;
    this.fileCount = 0;
    this.args = config.args;
    this.typeCounts = {};
  }

  init() {

    // this.performance.mark('A'); // Mark A for perf check
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
      // this.performance.mark('B');


      // start crawling
      this.jetty.moveTo([this.ROW.crawl, 5])
        .text('🕷  Started Crawling Index page!');
      this.spider.queue(`http://${this.TARGET_HOST}`, (doc) => this.handleRequest(doc));
    });
  }

  processFilePath(doc) {
    // Place everything within a folder this.STATIC_DIR
    let filePath = `./${this.STATIC_DIR}${decodeURIComponent(doc.res.req.path)}`;


    if (filePath.match(/\?.+$/) && doc.res.headers['content-type'].match('text/html')) { // If query string present remove from filename
      filePath = filePath.replace(/\?(.+)=(.+)$/, '--$1--$2');
    }else {
      if(filePath.match(/\?.+$/)){
        filePath = filePath.replace(/\?.+$/,'');
      }
    }

    // in no fileextension
    if (!filePath.match(/.\.(html)(\?.+)?$/) && doc.res.headers['content-type'].match('text/html')) {
      filePath += "/index.html"
    }
    // squeeze double slashes
    return filePath.replace(/\/\//, "/");
  }

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
        .text(`🗂  Total file count: ${this.fileCount++}`).moveTo([15, 0]);
    });
  }

  scrapeContent(doc) {
    // scrape JS files
    doc.$('script').toArray().forEach((script) => {
      let uri = doc.$(script).attr('src');

      if (uri) {
        let url = doc.resolve(uri.replace(/(\?.+)$/, ''));
        if (url.match(this.TARGET_HOST)) {
          this.spider.queue(url, (doc) => this.handleRequest(doc));
        }
      }
    });

    // scrape CSS files from @imports
    let styles = doc.$('style').toArray()
      .map(style => doc.$(style).text())
      .filter(style => style.match('@import'));
    let linkStyles = doc.$('link').toArray()
      .forEach(style => {
        const href = doc.$(style).attr('href');
        const url = doc.resolve(href);
        this.spider.queue(url, (doc) => this.handleRequest(doc));
      });

    styles.forEach((style) => {
      var regEx = /url\("(.*)"\)/g;
      let matches;
      while (matches = regEx.exec(style)) {
        // console.log('xxx', matches[1]);
        const url = doc.resolve(matches[1].replace(/(\?.+)$/, ''));
        // crawl more
        this.spider.queue(url, (doc) => this.handleRequest(doc));
      }
    });

    // Scrape linked html files
    let links = doc.$('a').toArray();
    links = links.sort(() => Math.random() - 0.5);
    links.forEach((elem) => {
      // do stuff with element
      let href = doc.$(elem).attr('href');
      if (href) {
        href = href.split('#')[0];
        const url = doc.resolve(href);
        // crawl more if the url has http protocol
        if(url.match(/^https?:\/\//)){
          this.spider.queue(url, (doc) => this.handleRequest(doc));
        }
      }
    });

    // Scrape linked image files
    let images = doc.$('img').toArray();
    images = images.sort(() => Math.random() - 0.5);
    images.forEach((elem) => {
      // do stuff with element
      let href = doc.$(elem).attr('src');
      if (href) {
        const url = doc.resolve(href);
        // crawl more
        this.spider.queue(url, (doc) => this.handleRequest(doc));
      }
    });
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
    const contentTypeShort = contentTypeShortMatch ? contentTypeShortMatch[1]: contentType;
    this.typeCounts[contentTypeShort] = this.typeCounts.hasOwnProperty(contentTypeShort) ? this.typeCounts[contentTypeShort]+1 : 1;
    // Scrape if the document is an HTML
    if (contentType.match('text/html')){
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
