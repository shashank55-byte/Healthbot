const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'demo'
  },
  fileName: String,
  name: String,
  fileType: String,
  documentType: String,
  contentExtractionStatus: String,
  uploadDate: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  fileSize: String,
  status: {
    type: String,
    default: 'Analyzed'
  },
  analysisSummary: String,
  suggestion: String,
  riskLevel: String,
  recordRiskLevel: String,
  recordRiskScore: Number,
  abnormalValueCount: Number,
  extractedParameters: [mongoose.Schema.Types.Mixed],
  abnormalValues: [mongoose.Schema.Types.Mixed],
  analysis: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
