#!/usr/bin/env node
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const inquirer = require('inquirer');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');
const display = require('./lib/display');
const Storage = require('./lib/storage');
const ImageDownloader = require('./lib/imageDownloader');
const utils = require('./lib/utils');
puppeteer.use(StealthPlugin());
class GoogleMapsReviewsScraper {
  constructor(config, runTimestamp) {
    this.config = config;
    this.runTimestamp = runTimestamp;
    this.storage = new Storage(config.baseDir || './data', runTimestamp);
    const runDir = this.storage.getRunDir();
    this.imageDownloader = new ImageDownloader({
      imageDir: path.join(runDir, 'images'),
      concurrency: config.imageConcurrency
    });
    this.logger = utils.createLogger(config.logDir || './logs');
    this.browser = null;
    this.page = null;
  }
  async init() {
    await this.storage.init();
    if (this.config.downloadImages) {
      await this.imageDownloader.init();
    }
  }
  async launchBrowser() {
    const spinner = display.startSpinner('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });
    this.page = await this.browser.newPage();
    if (this.config.blockResources) {
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }
    await this.page.setViewport({ width: 1280, height: 720 });
    await this.page.setUserAgent(this.config.userAgent);
    display.succeedSpinner('Browser launched successfully');
    this.logger.info('Browser launched');
  }
  async navigateToUrl() {
    const spinner = display.startSpinner('Navigating to Google Maps...');
    await this.page.goto(this.config.url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout
    });
    await this.page.waitForSelector('[role="main"]', { timeout: 8000 });
    const businessName = await this.page.evaluate(() => {
      const heading = document.querySelector('h1');
      return heading ? heading.textContent : 'Unknown Business';
    });
    display.succeedSpinner(`Loaded: ${businessName}`);
    this.logger.info(`Business: ${businessName}`);
    this.config.businessName = businessName;
  }
  async clickReviewsTab() {
    const spinner = display.startSpinner('Opening reviews tab...');
    await this.page.waitForSelector('button[aria-label*="Reviews"]', { timeout: 8000 });
    await this.page.click('button[aria-label*="Reviews"]');
    await utils.sleep(1500);
    display.succeedSpinner('Reviews tab opened');
    this.logger.info('Reviews tab clicked');
  }
  async setSortOrder() {
    if (this.config.sortBy === 'relevance') {
      return;
    }
    const spinner = display.startSpinner(`Sorting by ${this.config.sortBy}...`);
    try {
      await this.page.waitForSelector('button.HQzyZ[aria-label*="relevant"]', { timeout: 5000 });
      await this.page.click('button.HQzyZ[aria-label*="relevant"]');
      await utils.sleep(1000);
      const keywords = utils.getSortKeywords(this.config.sortBy);
      const clicked = await this.page.evaluate((keywords) => {
        const menuItems = document.querySelectorAll('[role="menuitemradio"]');
        for (const item of menuItems) {
          const text = item.textContent || '';
          if (keywords.some(keyword => text.includes(keyword))) {
            item.click();
            return true;
          }
        }
        return false;
      }, keywords);
      if (clicked) {
        await utils.sleep(2000);
        display.succeedSpinner(`Sorted by ${this.config.sortBy}`);
        this.logger.info(`Sort order set to: ${this.config.sortBy}`);
      } else {
        display.failSpinner(`Could not find sort option: ${this.config.sortBy}`);
      }
    } catch (error) {
      display.failSpinner('Failed to set sort order');
      this.logger.error(`Sort error: ${error.message}`);
    }
  }
  async getTotalReviewCount() {
    try {
      await utils.sleep(500);
      const count = await this.page.evaluate(() => {
        const selectors = [
          '.fontBodySmall',
          '.jANrlb .fontBodySmall',
          '[jslog*="25991"]'
        ];
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const match = element.textContent.match(/(\d+)\s+reviews?/i);
            if (match) {
              return parseInt(match[1]);
            }
          }
        }
        return null;
      });
      return count;
    } catch (error) {
      this.logger.error(`Error getting review count: ${error.message}`);
      return null;
    }
  }
  async scrollAndLoadReviews() {
    const targetCount = await this.getTotalReviewCount();
    if (targetCount) {
      display.info(`📊 Starting review collection... (Target: ${targetCount} reviews)`);
      this.logger.info(`Target review count: ${targetCount}`);
    } else {
      display.info('📊 Starting review collection...');
      this.logger.info('Beginning scroll loop (target count unknown)');
    }
    await this.page.click('.jftiEf.fontBodyMedium[data-review-id]').catch(() => {});
    await utils.sleep(300);
    let previousReviewCount = 0;
    let noChangeCount = 0;
    let foundAllReviews = false;
    for (let attempt = 0; attempt < this.config.maxScrolls; attempt++) {
      const currentReviewCount = await this.page.evaluate(() => {
        return document.querySelectorAll('.jftiEf.fontBodyMedium[data-review-id]').length;
      });
      const newReviews = currentReviewCount - previousReviewCount;
      if (attempt % 10 === 0 && currentReviewCount > 0) {
        if (targetCount) {
          display.info(`📥 Progress: ${currentReviewCount}/${targetCount} reviews loaded${newReviews > 0 ? ` (+${newReviews} new)` : ''}`);
        } else {
          display.info(`📥 Loaded ${currentReviewCount} reviews${newReviews > 0 ? ` (+${newReviews} new)` : ''}...`);
        }
      }
      if (targetCount && currentReviewCount >= targetCount) {
        display.success(`✅ Complete! Loaded all ${currentReviewCount} reviews`);
        foundAllReviews = true;
        break;
      }
      await this.page.keyboard.press('PageDown');
      await utils.sleep(80);
      await this.page.keyboard.press('PageDown');
      await utils.sleep(80);
      await this.page.keyboard.press('PageDown');
      await utils.sleep(this.config.scrollDelay);
      if (currentReviewCount === previousReviewCount) {
        noChangeCount++;
        if (noChangeCount >= 15) {
          if (targetCount) {
            display.warning(`⚠️  Reached end early - Loaded ${currentReviewCount}/${targetCount} reviews`);
          } else {
            display.success(`✅ Reached end - Total: ${currentReviewCount} reviews`);
          }
          foundAllReviews = true;
          break;
        }
      } else {
        noChangeCount = 0;
      }
      previousReviewCount = currentReviewCount;
    }
    if (!foundAllReviews) {
      if (targetCount) {
        display.warning(`⚠️  Reached scroll limit - Loaded ${previousReviewCount}/${targetCount} reviews`);
      } else {
        display.warning('⚠️  Reached maximum scroll limit');
      }
    }
    this.logger.info(`Scroll completed. Reviews found: ${previousReviewCount}${targetCount ? ` (target: ${targetCount})` : ''}`);
    return previousReviewCount;
  }
  async extractReviews() {
    const spinner = display.startSpinner('Extracting review data...');
    const reviews = await this.page.evaluate(() => {
      const reviewElements = document.querySelectorAll('.jftiEf.fontBodyMedium[data-review-id]');
      const reviewData = [];
      reviewElements.forEach(review => {
        try {
          const reviewId = review.getAttribute('data-review-id') || null;
          const nameEl = review.querySelector('.d4r55.fontTitleMedium');
          const name = nameEl ? nameEl.textContent.trim() : 'Unknown';
          let rating = 0;
          const ratingTextEl = review.querySelector('.fzvQIb');
          if (ratingTextEl) {
            const ratingText = ratingTextEl.textContent.trim();
            const ratingMatch = ratingText.match(/(\d+)/);
            rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;
          }
          const reviewTextEl = review.querySelector('.MyEned .wiI7pd');
          const text = reviewTextEl ? reviewTextEl.textContent.trim() : 'No review text';
          const dateEl = review.querySelector('.DU9Pgb .xRkPPb, .rsqaWe');
          const date = dateEl ? dateEl.textContent.trim().replace(' on Google', '').replace(' on', '') : null;
          const likesEl = review.querySelector('.pkWtMe');
          const likes = likesEl ? parseInt(likesEl.textContent.trim()) : 0;
          const ownerResponseEl = review.querySelector('.CDe7pd .wiI7pd');
          const ownerResponse = ownerResponseEl ? ownerResponseEl.textContent.trim() : null;
          const profilePicEl = review.querySelector('button.WEBjve img.NBa7we');
          const profilePicture = profilePicEl ? profilePicEl.getAttribute('src') : null;
          const profileLinkEl = review.querySelector('button.WEBjve');
          const profileUrl = profileLinkEl ? profileLinkEl.getAttribute('data-href') : null;
          const imageButtons = review.querySelectorAll('.KtCyie button.Tya61d');
          const images = Array.from(imageButtons).map(btn => {
            const style = btn.getAttribute('style') || '';
            const decoded = style.replace(/&quot;/g, '"');
            const match = decoded.match(/url\("([^"]+)"\)|url\('([^']+)'\)|url\(([^)]+)\)/);
            if (match) {
              let url = match[1] || match[2] || match[3];
              if (url) {
                url = url.trim();
                url = url.replace(/=w\d+-h\d+-p/g, '=s0');
                return url;
              }
            }
            return null;
          }).filter(Boolean);
          reviewData.push({
            reviewId,
            name,
            rating,
            text,
            date,
            likes,
            ownerResponse,
            profilePicture,
            profileUrl,
            images,
            scrapedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error parsing review:', error);
        }
      });
      return reviewData;
    });
    display.succeedSpinner(`Extracted ${reviews.length} reviews`);
    this.logger.info(`Extracted ${reviews.length} reviews`);
    return reviews;
  }
  processDates(reviews) {
    return reviews.map(review => ({
      ...review,
      dateISO: utils.parseRelativeDate(review.date)
    }));
  }
  async downloadImages(reviews) {
    if (!this.config.downloadImages || reviews.length === 0) {
      return reviews;
    }
    display.section('📥 Downloading Images');
    this.logger.info('Starting image downloads');
    const progressBar = display.createProgressBar(100, 'Images');
    await this.imageDownloader.downloadAllImages(reviews, (current, total) => {
      const percent = Math.floor((current / total) * 100);
      progressBar.update(percent);
    });
    display.stopProgress();
    const stats = this.imageDownloader.getStats();
    display.success(`Downloaded ${stats.downloaded} images`);
    this.logger.info(`Downloaded ${stats.downloaded} images`);
    return reviews;
  }
  async saveResults(reviews) {
    const spinner = display.startSpinner('Saving results...');
    await this.storage.saveReviews(reviews);
    if (this.config.exportCSV) {
      await this.storage.exportToCSV(reviews);
    }
    const stats = this.storage.calculateStats(reviews);
    await this.storage.saveMetadata({
      url: this.config.url,
      sortBy: this.config.sortBy,
      totalReviews: reviews.length,
      stats: stats,
      runTimestamp: this.runTimestamp
    });
    display.succeedSpinner('Results saved successfully');
    this.logger.info(`Saved ${reviews.length} reviews to ${this.storage.getRunDir()}`);
    return reviews;
  }
  async scrape() {
    try {
      await this.init();
      await this.launchBrowser();
      await this.navigateToUrl();
      await this.clickReviewsTab();
      await this.setSortOrder();
      await this.scrollAndLoadReviews();
      let reviews = await this.extractReviews();
      reviews = this.processDates(reviews);
      reviews = await this.downloadImages(reviews);
      const allReviews = await this.saveResults(reviews);
      const stats = this.storage.calculateStats(allReviews);
      display.showStats(stats);
      display.showSampleReviews(allReviews, 3);
      display.showSummary({
        outputFile: this.storage.getRunDir(),
        count: allReviews.length,
        imagesDownloaded: this.config.downloadImages ? this.imageDownloader.getStats().downloaded : 0
      });
      this.logger.info('Scraping completed successfully');
    } catch (error) {
      display.error(`Fatal error: ${error.message}`);
      this.logger.error(`Fatal error: ${error.stack}`);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}
async function loadConfig(configPath = './config.yaml') {
  try {
    const fileContent = await fs.readFile(configPath, 'utf8');
    return yaml.load(fileContent);
  } catch (error) {
    return {};
  }
}
async function runWizard() {
  display.showBanner();
  display.section('⚙️  Configuration Wizard');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter Google Maps URL:',
      validate: (input) => {
        if (utils.isValidGoogleMapsUrl(input)) {
          return true;
        }
        return 'Please enter a valid Google Maps URL';
      }
    },
    {
      type: 'list',
      name: 'sortBy',
      message: 'Sort reviews by:',
      choices: [
        { name: '🔥 Newest First', value: 'newest' },
        { name: '⭐ Highest Rating', value: 'highest' },
        { name: '👎 Lowest Rating', value: 'lowest' },
        { name: '🎯 Most Relevant (default)', value: 'relevance' }
      ],
      default: 'relevance'
    },
    {
      type: 'confirm',
      name: 'downloadImages',
      message: 'Download review images?',
      default: false
    },
    {
      type: 'confirm',
      name: 'headless',
      message: 'Run in headless mode (no browser window)?',
      default: true
    }
  ]);
  return answers;
}
async function editConfigFile(configPath = './config.yaml') {
  display.showBanner();
  display.section('📝 Edit Configuration');
  const currentConfig = await loadConfig(configPath);
  display.info('Current settings will be shown as defaults. Press Enter to keep current value.\n');
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'sortBy',
      message: 'Sort reviews by:',
      choices: [
        { name: '🔥 Newest First', value: 'newest' },
        { name: '⭐ Highest Rating', value: 'highest' },
        { name: '👎 Lowest Rating', value: 'lowest' },
        { name: '🎯 Most Relevant (default)', value: 'relevance' }
      ],
      default: currentConfig.sortBy || 'relevance'
    },
    {
      type: 'number',
      name: 'maxScrolls',
      message: 'Maximum scroll attempts:',
      default: currentConfig.maxScrolls || 250,
      validate: (input) => input > 0 || 'Must be greater than 0'
    },
    {
      type: 'number',
      name: 'scrollDelay',
      message: 'Delay between scrolls (milliseconds):',
      default: currentConfig.scrollDelay || 800,
      validate: (input) => input >= 0 || 'Must be 0 or greater'
    },
    {
      type: 'confirm',
      name: 'headless',
      message: 'Run in headless mode (no browser window)?',
      default: currentConfig.headless !== undefined ? currentConfig.headless : true
    },
    {
      type: 'confirm',
      name: 'downloadImages',
      message: 'Download review images?',
      default: currentConfig.downloadImages || false
    },
    {
      type: 'confirm',
      name: 'exportCSV',
      message: 'Export to CSV format?',
      default: currentConfig.exportCSV || false
    },
    {
      type: 'number',
      name: 'imageConcurrency',
      message: 'Number of parallel image downloads:',
      default: currentConfig.imageConcurrency || 5,
      when: (answers) => answers.downloadImages,
      validate: (input) => input > 0 || 'Must be greater than 0'
    }
  ]);
  const configContent = await fs.readFile(configPath, 'utf8');
  const changes = {};
  if (answers.sortBy !== currentConfig.sortBy) changes.sortBy = answers.sortBy;
  if (answers.maxScrolls !== currentConfig.maxScrolls) changes.maxScrolls = answers.maxScrolls;
  if (answers.scrollDelay !== currentConfig.scrollDelay) changes.scrollDelay = answers.scrollDelay;
  if (answers.headless !== currentConfig.headless) changes.headless = answers.headless;
  if (answers.downloadImages !== currentConfig.downloadImages) changes.downloadImages = answers.downloadImages;
  if (answers.exportCSV !== currentConfig.exportCSV) changes.exportCSV = answers.exportCSV;
  if (answers.imageConcurrency && answers.imageConcurrency !== currentConfig.imageConcurrency) {
    changes.imageConcurrency = answers.imageConcurrency;
  }
  if (Object.keys(changes).length === 0) {
    display.info('No changes made to configuration.');
    return currentConfig;
  }
  let updatedContent = configContent;
  for (const [key, newValue] of Object.entries(changes)) {
    const regex = new RegExp(`^(${key}:\\s*)([^\\s#]+)(.*)$`, 'm');
    const match = updatedContent.match(regex);
    if (match) {
      const [fullMatch, prefix, oldValue, suffix] = match;
      let formattedValue;
      if (typeof newValue === 'string') {
        formattedValue = `"${newValue}"`;
      } else if (typeof newValue === 'boolean') {
        formattedValue = newValue.toString();
      } else {
        formattedValue = newValue.toString();
      }
      const newLine = `${prefix}${formattedValue}${suffix}`;
      updatedContent = updatedContent.replace(fullMatch, newLine);
    }
  }
  await fs.writeFile(configPath, updatedContent, 'utf8');
  display.success(`✅ Configuration saved (${Object.keys(changes).length} value${Object.keys(changes).length > 1 ? 's' : ''} updated)`);
  return {
    ...currentConfig,
    ...answers
  };
}
async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('url', {
      alias: 'u',
      type: 'string',
      description: 'Google Maps URL to scrape'
    })
    .option('sort', {
      alias: 's',
      type: 'string',
      choices: ['newest', 'highest', 'lowest', 'relevance'],
      description: 'Sort order for reviews'
    })
    .option('headless', {
      type: 'boolean',
      description: 'Run in headless mode'
    })
    .option('images', {
      alias: 'i',
      type: 'boolean',
      description: 'Download images'
    })
    .option('csv', {
      type: 'boolean',
      description: 'Export to CSV format (in addition to JSON)'
    })
    .option('maxScrolls', {
      alias: 'm',
      type: 'number',
      description: 'Maximum number of scroll attempts'
    })
    .option('config', {
      alias: 'c',
      type: 'string',
      default: './config.yaml',
      description: 'Path to config file'
    })
    .option('wizard', {
      alias: 'w',
      type: 'boolean',
      description: 'Run interactive configuration wizard'
    })
    .help()
    .alias('help', 'h')
    .argv;
  const fileConfig = await loadConfig(argv.config);
  display.showBanner();
  const hasCliArgs = argv.url || argv.sort !== undefined || argv.headless !== undefined ||
                     argv.images !== undefined || argv.csv !== undefined ||
                     argv.maxScrolls !== undefined || argv.wizard;
  let config;
  if (!hasCliArgs) {
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'How would you like to configure the scraper?',
        choices: [
          { name: '⚡ Use default settings (just enter URL)', value: 'default' },
          { name: '⚙️  Manual configuration (interactive wizard)', value: 'wizard' },
          { name: '📝 Edit config.yaml settings', value: 'editConfig' }
        ],
        default: 'default'
      }
    ]);
    if (mode === 'wizard') {
      config = await runWizard();
    } else if (mode === 'editConfig') {
      await editConfigFile(argv.config);
      const { runNow } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'runNow',
          message: 'Configuration saved! Run scraper now?',
          default: true
        }
      ]);
      if (!runNow) {
        process.exit(0);
      }
      const newConfig = await loadConfig(argv.config);
      config = { ...newConfig };
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Enter Google Maps URL:',
          validate: (input) => {
            if (utils.isValidGoogleMapsUrl(input)) {
              return true;
            }
            return 'Please enter a valid Google Maps URL';
          }
        }
      ]);
      config.url = url;
    } else {
      config = { ...fileConfig };
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Enter Google Maps URL:',
          validate: (input) => {
            if (utils.isValidGoogleMapsUrl(input)) {
              return true;
            }
            return 'Please enter a valid Google Maps URL';
          }
        }
      ]);
      config.url = url;
    }
  } else if (argv.wizard) {
    config = await runWizard();
  } else {
    config = { ...fileConfig };
  }
  if (argv.url) config.url = argv.url;
  if (argv.sort) config.sortBy = argv.sort;
  if (argv.headless !== undefined) config.headless = argv.headless;
  if (argv.images !== undefined) config.downloadImages = argv.images;
  if (argv.csv !== undefined) config.exportCSV = argv.csv;
  if (argv.maxScrolls !== undefined) config.maxScrolls = argv.maxScrolls;
  config = {
    headless: true,
    timeout: 20000,
    sortBy: 'relevance',
    maxScrolls: 250,
    scrollDelay: 800,
    baseDir: './data',
    exportCSV: false,
    downloadImages: false,
    imageConcurrency: 5,
    blockResources: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    logDir: './logs',
    ...config
  };
  if (!utils.isValidGoogleMapsUrl(config.url)) {
    display.error('Invalid Google Maps URL');
    process.exit(1);
  }
  const now = new Date();
  const runTimestamp = now.toISOString()
    .slice(0, 16)
    .replace('T', '_')
    .replace(/:/g, '-');
  display.section('🔧 Configuration');
  display.showConfig(config);
  const scraper = new GoogleMapsReviewsScraper(config, runTimestamp);
  await scraper.scrape();
}
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
module.exports = GoogleMapsReviewsScraper;
