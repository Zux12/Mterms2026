// server/services/abstractText.js

const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const pdfParse = require('pdf-parse');

const { getBucket, ObjectId } = require('../lib/gridfs');

function cleanExtractedText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getFileExtension(filename = '') {
  const name = String(filename || '').toLowerCase().trim();
const dotIndex = name.lastIndexOf('.');

  
  if (dotIndex === -1) return '';

  return name.slice(dotIndex);
}

function downloadGridFSFileToBuffer(gridFsId) {
  return new Promise((resolve, reject) => {
    let objectId;

    try {
      objectId =
        gridFsId instanceof ObjectId
          ? gridFsId
          : new ObjectId(String(gridFsId));
    } catch (err) {
      reject(new Error('The abstract file ID is invalid.'));
      return;
    }

    let bucket;

    try {
      bucket = getBucket();
    } catch (err) {
      reject(err);
      return;
    }

    const chunks = [];

    const stream = bucket.openDownloadStream(objectId);

    stream.on('data', chunk => {
      chunks.push(chunk);
    });

    stream.on('error', err => {
      if (err && err.code === 'ENOENT') {
        reject(new Error('The abstract file was not found in GridFS.'));
        return;
      }

      reject(
        new Error(
          `The abstract file could not be downloaded: ${
            err?.message || 'Unknown GridFS error'
          }`
        )
      );
    });

    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);

      if (!buffer.length) {
        reject(new Error('The abstract file is empty.'));
        return;
      }

      resolve(buffer);
    });
  });
}

async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });

    const text = cleanExtractedText(result?.value);

    if (!text) {
      throw new Error('No readable text was found in the DOCX file.');
    }

    return text;
  } catch (err) {
    throw new Error(
      `The DOCX abstract could not be read: ${
        err?.message || 'Unknown DOCX extraction error'
      }`
    );
  }
}

async function extractWordText(buffer) {
  try {
    const extractor = new WordExtractor();

    const document = await extractor.extract(buffer);

    const text = cleanExtractedText(document?.getBody());

    if (!text) {
      throw new Error('No readable text was found in the Word file.');
    }

    return text;
  } catch (err) {
    throw new Error(
      `The Word abstract could not be read: ${
        err?.message || 'Unknown Word extraction error'
      }`
    );
  }
}

async function extractPdfText(buffer) {
  try {
    const result = await pdfParse(buffer);

    const text = cleanExtractedText(result?.text);

    if (!text) {
      throw new Error('No readable text was found in the PDF file.');
    }

    return text;
  } catch (err) {
    throw new Error(
      `The PDF abstract could not be read: ${
        err?.message || 'Unknown PDF extraction error'
      }`
    );
  }
}

async function extractAbstractText({
  gridFsId,
  filename,
  contentType
}) {
  if (!gridFsId) {
    throw new Error('The abstract GridFS file ID is missing.');
  }

  const buffer = await downloadGridFSFileToBuffer(gridFsId);

  const extension = getFileExtension(filename);
  const mimeType = String(contentType || '')
    .toLowerCase()
    .trim();

  let text;

  if (
    extension === '.docx' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    text = await extractDocxText(buffer);
  } else if (
    extension === '.doc' ||
    mimeType === 'application/msword'
  ) {
    text = await extractWordText(buffer);
  } else if (
    extension === '.pdf' ||
    mimeType === 'application/pdf'
  ) {
    text = await extractPdfText(buffer);
  } else {
    throw new Error(
      `Unsupported abstract file type: ${
        extension || mimeType || 'unknown'
      }.`
    );
  }

  if (text.length < 100) {
    throw new Error(
      'The extracted abstract text is too short for assessment.'
    );
  }

  if (text.length > 50000) {
    throw new Error(
      'The extracted abstract text is too long for assessment.'
    );
  }

  return {
    text,
    characterCount: text.length,
    wordCount: text
      .split(/\s+/)
      .filter(Boolean)
      .length
  };
}

module.exports = {
  extractAbstractText,
  downloadGridFSFileToBuffer,
  cleanExtractedText
};
