// server/lib/gridfs.js
const { GridFSBucket, ObjectId } = require('mongodb');
const mongoose = require('mongoose');

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB not connected yet');
  // Bucket will use collections: mterms_uploads.files / mterms_uploads.chunks
  return new GridFSBucket(db, { bucketName: 'mterms_uploads' });
}

module.exports = { getBucket, ObjectId };
