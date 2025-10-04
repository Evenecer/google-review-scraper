const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
class ImageDownloader {
  constructor(config = {}) {
    this.baseDir = config.imageDir || './data/images';
    this.profilesDir = path.join(this.baseDir, 'profiles');
    this.reviewsDir = path.join(this.baseDir, 'reviews');
    this.concurrency = config.concurrency || 5;
    this.downloadedCount = 0;
  }
  async init() {
    await fs.mkdir(this.profilesDir, { recursive: true });
    await fs.mkdir(this.reviewsDir, { recursive: true });
  }
  async downloadImage(url, filepath) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const writer = createWriteStream(filepath);
      await pipeline(response.data, writer);
      return true;
    } catch (error) {
      console.error(`Failed to download: ${url.substring(0, 50)}...`);
      return false;
    }
  }
  async downloadBatch(images) {
    const queue = [...images];
    const results = [];
    const workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.worker(queue, results));
    }
    await Promise.all(workers);
    return results;
  }
  async worker(queue, results) {
    while (queue.length > 0) {
      const image = queue.shift();
      if (!image) break;
      const success = await this.downloadImage(image.url, image.filepath);
      if (success) {
        this.downloadedCount++;
        results.push(image);
      }
    }
  }
  async downloadProfilePicture(url, reviewId) {
    if (!url || url === 'N/A') return null;
    try {
      const ext = this.getImageExtension(url);
      const filename = `profile-${reviewId}${ext}`;
      const filepath = path.join(this.profilesDir, filename);
      const success = await this.downloadImage(url, filepath);
      return success ? filepath : null;
    } catch (error) {
      return null;
    }
  }
  
  async downloadReviewImages(urls, reviewId) {
    if (!urls || urls.length === 0) return [];
    const downloadedPaths = [];
    for (let i = 0; i < urls.length; i++) {
      try {
        const ext = this.getImageExtension(urls[i]);
        const filename = `review-${reviewId}-${i}${ext}`;
        const filepath = path.join(this.reviewsDir, filename);
        const success = await this.downloadImage(urls[i], filepath);
        if (success) {
          downloadedPaths.push(filepath);
        }
      } catch (error) {
      }
    }
    return downloadedPaths;
  }
  getImageExtension(url) {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp)/i);
    return match ? match[0] : '.jpg';
  }
  async downloadAllImages(reviews, progressCallback) {
    const downloadTasks = [];
    reviews.forEach((review, index) => {
      if (review.profilePicture && review.profilePicture !== 'N/A') {
        downloadTasks.push({
          type: 'profile',
          url: review.profilePicture,
          reviewId: review.reviewId || `review-${index}`,
          reviewIndex: index
        });
      }
      if (review.images && Array.isArray(review.images)) {
        review.images.forEach((imageUrl, imgIndex) => {
          downloadTasks.push({
            type: 'review',
            url: imageUrl,
            reviewId: review.reviewId || `review-${index}`,
            reviewIndex: index,
            imageIndex: imgIndex
          });
        });
      }
    });
    const imagesToDownload = downloadTasks.map(task => {
      const ext = this.getImageExtension(task.url);
      let filename, dir;
      if (task.type === 'profile') {
        filename = `profile-${task.reviewId}${ext}`;
        dir = this.profilesDir;
      } else {
        filename = `review-${task.reviewId}-${task.imageIndex}${ext}`;
        dir = this.reviewsDir;
      }
      return {
        ...task,
        filepath: path.join(dir, filename),
        filename
      };
    });
    const batchSize = 10;
    for (let i = 0; i < imagesToDownload.length; i += batchSize) {
      const batch = imagesToDownload.slice(i, i + batchSize);
      await this.downloadBatch(batch);
      if (progressCallback) {
        progressCallback(Math.min(i + batchSize, imagesToDownload.length), imagesToDownload.length);
      }
    }
    imagesToDownload.forEach(task => {
      const review = reviews[task.reviewIndex];
      if (!review) return;
      if (task.type === 'profile') {
        review.profilePictureLocal = task.filepath;
      } else {
        if (!review.imagesLocal) {
          review.imagesLocal = [];
        }
        review.imagesLocal[task.imageIndex] = task.filepath;
      }
    });
    return this.downloadedCount;
  }
  getStats() {
    return {
      downloaded: this.downloadedCount
    };
  }
}
module.exports = ImageDownloader;