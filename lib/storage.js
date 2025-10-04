const fs = require('fs').promises;
const path = require('path');
class Storage {
  constructor(baseDir = './data', runTimestamp) {
    this.baseDir = baseDir;
    this.runTimestamp = runTimestamp;
    this.runDir = path.join(baseDir, runTimestamp);
    this.reviewsFile = path.join(this.runDir, 'reviews.json');
    this.csvFile = path.join(this.runDir, 'reviews.csv');
    this.metadataFile = path.join(this.runDir, 'metadata.json');
  }
  async init() {
    try {
      await fs.mkdir(this.runDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error.message);
    }
  }
  getRunDir() {
    return this.runDir;
  }
  async saveReviews(reviews) {
    try {
      const jsonData = JSON.stringify(reviews, null, 2);
      await fs.writeFile(this.reviewsFile, jsonData, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving reviews:', error.message);
      return false;
    }
  }
 
  async saveMetadata(metadata) {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        ...metadata
      };
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(this.metadataFile, jsonData, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving metadata:', error.message);
      return false;
    }
  }
  async exportToCSV(reviews) {
    try {
      if (reviews.length === 0) {
        return null;
      }
      const headers = ['Name', 'Rating', 'Date', 'Review Text', 'Owner Response', 'Likes', 'Review ID'];
      const csvRows = [headers.join(',')];
      reviews.forEach(review => {
        const row = [
          this.escapeCsvField(review.name),
          review.rating || '',
          this.escapeCsvField(review.date || ''),
          this.escapeCsvField(review.text),
          this.escapeCsvField(review.ownerResponse || ''),
          review.likes || 0,
          this.escapeCsvField(review.reviewId)
        ];
        csvRows.push(row.join(','));
      });
      await fs.writeFile(this.csvFile, csvRows.join('\n'), 'utf8');
      return this.csvFile;
    } catch (error) {
      console.error('Error exporting to CSV:', error.message);
      return null;
    }
  }
  escapeCsvField(field) {
    if (field === null || field === undefined) {
      return '';
    }
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  calculateStats(reviews) {
    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        avgRating: 0,
        ratings: {},
        withText: 0,
        withImages: 0,
        withOwnerResponse: 0
      };
    }
    const ratings = {};
    let totalRating = 0;
    let withText = 0;
    let withImages = 0;
    let withOwnerResponse = 0;
    reviews.forEach(review => {
      const rating = review.rating || 0;
      ratings[rating] = (ratings[rating] || 0) + 1;
      totalRating += rating;
      if (review.text && review.text !== 'No review text') {
        withText++;
      }
      if (review.images && review.images.length > 0) {
        withImages++;
      }
      if (review.ownerResponse) {
        withOwnerResponse++;
      }
    });
    return {
      totalReviews: reviews.length,
      avgRating: totalRating / reviews.length,
      ratings,
      withText,
      withImages,
      withOwnerResponse
    };
  }
}
module.exports = Storage;