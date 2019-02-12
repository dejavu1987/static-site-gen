const Spider = require('node-spider');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
// const s3 = require('s3');
const Jetty = require("jetty");

const {performance} = require('perf_hooks');

const args = getArgs();

performance.mark('A');

let fileCount = 0;

// Create a new Jetty object. This is a through stream with some additional
// methods on it. Additionally, connect it to process.stdout
const jetty = new Jetty(process.stdout);

jetty.clear();

const TARGET_HOST = args.host || 'localhost:3000';

const STATIC_DIR = args.dest || 'static';

const ROW = {
  intro: 0,
  config: 4,
  folder: 6,
  crawl: 7,
  file: 10,
  fileCount: 11,
  success: 13,
  perf: 15,
  perf1: 16,
};

const S3_CREDENTIALS = {
  "accessKeyId": "AKIAJM6ISUKVRGJ5ZW3Q",
  "secretAccessKey": "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",
  "region": "eu-central-1",
  "bucket": "kitt-test"
};

jetty.moveTo([ROW.config, 3]).rgb(150).text(`Configs: ${JSON.stringify(args)}`);


const spider = new Spider({
  // How many requests can be run in parallel
  concurrent: args.cc || 30,
  // How long to wait after each request
  delay: args.delay || 200,
  // A stream to where internal logs are sent, optional

  // Re-visit visited URLs, false by default
  allowDuplicates: false,
  // If `true` all queued handlers will be try-catch'd, errors go to `error` callback
  catchErrors: true,
  // If `true` the spider will set the Referer header automatically on subsequent requests
  addReferrer: false,
  // If `true` adds the X-Requested-With:XMLHttpRequest header
  xhr: false,
  // If `true` adds the Connection:keep-alive header and forever option on request module
  keepAlive: false,
  // Called when there's an error, throw will be used if none is provided
  error: function (err, url) {
    console.error(err, url);
  },
  // Called when there are no more requests
  done: function () {
    jetty.moveTo([ROW.success, 3]).rgb(150).text('Successfully generated static site!');

    performance.mark('C');


    performance.measure('A to B', 'A', 'B');
    const measure = performance.getEntriesByName('A to B')[0];
    jetty.moveTo([ROW.perf, 3]).rgb(11).text(`Time to delete static: ${(measure.duration / 1000).toFixed(3)} sec`);

    performance.measure('A to C', 'A', 'C');

    const measure1 = performance.getEntriesByName('A to C')[0];

    jetty.moveTo([ROW.perf1, 3]).rgb(11).text(`Time to all queries: ${(measure1.duration / 1000).toFixed(2)} sec`);

    // setTimeout(() => {
    //   console.log('Uploading to s3!');
    //   var client = s3.createClient({
    //     maxAsyncS3: 20,     // this is the default
    //     s3RetryCount: 3,    // this is the default
    //     s3RetryDelay: 1000, // this is the default
    //     multipartUploadThreshold: 20971520, // this is the default (20 MB)
    //     multipartUploadSize: 15728640, // this is the default (15 MB)
    //     s3Options: {
    //       accessKeyId: S3_CREDENTIALS.accessKeyId,
    //       secretAccessKey: S3_CREDENTIALS.secretAccessKey,
    //       region: S3_CREDENTIALS.region
    //       // any other options are passed to new AWS.S3()
    //       // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
    //     },
    //   });
    //   var params = {
    //     localDir: STATIC_DIR,
    //     deleteRemoved: true, // default false, whether to remove s3 objects
    //                          // that have no corresponding local file.
    //
    //     s3Params: {
    //       Bucket: S3_CREDENTIALS.bucket,
    //       Prefix: "static",
    //       // other options supported by putObject, except Body and ContentLength.
    //       // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
    //     },
    //   };
    //   var uploader = client.uploadDir(params);
    //   uploader.on('error', function(err) {
    //     console.error("unable to sync:", err.stack);
    //   });
    //   uploader.on('progress', function() {
    //     console.log("progress", uploader.progressAmount, uploader.progressTotal);
    //   });
    //   uploader.on('end', function() {
    //     console.log("done uploading");
    //   });
    // }, 1000);

  },

  //- All options are passed to `request` module, for example:
  headers: {'user-agent': 'node-static-generator'},
  encoding: 'utf8'
});

const handleRequest = function (doc) {
  // new page response
  // if the host is not same as TARGET_HOST dont do anything
  if (doc.res.request.host != TARGET_HOST.split(':')[0])
    return;
  // Place everything within a folder 'static'
  let filePath = `./${STATIC_DIR}${decodeURIComponent(doc.res.req.path)}`;


  if (filePath.match(/\?.+$/)) { // If query string present remove from filename
    filePath = filePath.replace(/\?(.+)=(.+)$/, '--$1--$2');
  }

  // in no fileextension
  if (!filePath.match(/.\.(html|css|js|svg)(\?.+)?$/)) {
    filePath += "/index.html"
  }
  // squeeze double slashes
  filePath = filePath.replace(/\/\//, "/");
  // Create parents if dirs doesnt exist
  ensureDirectoryExistence(filePath);
  // Write the file
  fs.writeFile(filePath, doc.res.body, function (err) {
    if (err) {
      return console.log(err);
    }
    jetty.moveTo([ROW.file, 5]).rgb(82, false).erase(100).moveTo([ROW.file, 5]).text(`💾 Last saved: ${filePath}`);
    jetty.moveTo([ROW.fileCount, 5]).erase(40).rgb(9, false).moveTo([ROW.fileCount, 5]).text(`🗂  Total file count: ${fileCount++}`).moveTo([15, 0]);
  });

  // scrape JS files
  doc.$('script').toArray().forEach((script) => {
    let uri = doc.$(script).attr('src');

    if (uri) {
      let url = doc.resolve(uri.replace(/(\?.+)$/, ''));
      if (url.match(TARGET_HOST)) {
        spider.queue(url, handleRequest);
      }
    }
  });

  // scrape CSS files from @imports
  let styles = doc.$('style').toArray()
    .map(style => doc.$(style).text())
    .filter(style => style.match('@import'));

  styles.forEach((style) => {
    var regEx = /url\("(.*)"\)/g;
    while (myArray = regEx.exec(style)) {
      // console.log('xxx', myArray[1]);
      const url = doc.resolve(myArray[1].replace(/(\?.+)$/, ''));
      // crawl more
      spider.queue(url, handleRequest);
    }
  });

  // Scrape linked html files
  let links = doc.$('a').toArray();
  links = links.sort((a, b) => Math.random() > 0.5);
  links.forEach(function (elem) {
    // do stuff with element
    let href = doc.$(elem).attr('href');
    if (href) {
      href = href.split('#')[0];
      const url = doc.resolve(href);
      // crawl more
      spider.queue(url, handleRequest);
    }
  });

  // Scrape linked image files
  let images = doc.$('img').toArray();
  images = images.sort((a, b) => Math.random() > 0.5);
  images.forEach(function (elem) {
    // do stuff with element
    let href = doc.$(elem).attr('src');
    if (href) {
      const url = doc.resolve(href);
      // crawl more
      spider.queue(url, handleRequest);
    }
  });

};

jetty.moveTo([ROW.intro, 0]).text('=========================================================\n\tINVIQA Static Site Generator\n=========================================================');
// Clean up static folder before starting the crawler
rimraf(`./${STATIC_DIR}`, function () {
  jetty.moveTo([ROW.folder, 5]).text('🗑  Static folder deleted!');
  performance.mark('B');


  // start crawling
  jetty.moveTo([ROW.crawl, 5]).text('🕷  Started Crawling Index page!');
  spider.queue(`http://${TARGET_HOST}`, handleRequest);
});

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}




function getArgs () {
  const args = {};
  process.argv
    .slice(2, process.argv.length)
    .forEach( arg => {
      // long arg
      if (arg.slice(0,2) === '--') {
        const longArg = arg.split('=');
        args[longArg[0].slice(2,longArg[0].length)] = longArg[1]
      }
      // flags
      else if (arg[0] === '-') {
        const flags = arg.slice(1,arg.length).split('');
        flags.forEach(flag => {
          args[flag] = true
        })
      }
    });
  return args
}
