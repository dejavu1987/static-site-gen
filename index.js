/**
 *
 * Static Site generator Main file
 *
 * @author anil.maharjan@inviqa.com
 */

const {getArgs} = require('./src/getArgs');
const args = getArgs();

const {SSG} = require('./src/SSG');

// Arguments to config
const TARGET_HOST = args.host || 'localhost:3000';
const STATIC_DIR = args.dest || 'website';
const CONCURRENCY = args.cc || 30;
const DELAY = args.delay || 200;

// UI Config What goes on which row
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


// Spider configs
const spiderConfig = {
  concurrent: CONCURRENCY,
  delay: DELAY,
  allowDuplicates: false,
  catchErrors: true,
  addReferrer: false,
  xhr: false,
  keepAlive: false,
  headers: {'user-agent': 'node-static-generator'},
  encoding: 'utf8'
};

// Initialize
const generator = new SSG(spiderConfig, {
  STATIC_DIR: STATIC_DIR,
  TARGET_HOST: TARGET_HOST,
  ROW: ROW,
  args: args
});

generator.init();

