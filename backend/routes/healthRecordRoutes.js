const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const memoryRecords = [];

function currentUserId(req) {
  return req.user?.id || req.body.userId || req.query.userId || 'demo';
}

function toPlain(record) {
  const plain = record?.toObject ? record.toObject() : { ...record };
  plain.id = String(plain._id || plain.id);
  plain.name = plain.name || plain.fileName;
  plain.riskLevel = plain.riskLevel || plain.recordRiskLevel;
  plain.analysis = plain.analysis || {
    summary: plain.analysisSummary,
    riskLevel: plain.riskLevel,
    reportRiskScore: plain.recordRiskScore,
    extractedParameters: plain.extractedParameters || [],
    abnormalValues: plain.abnormalValues || []
  };
  return plain;
}

function normalizeRecord(input, userId) {
  const analysis = input.analysis || {};
  const extractedParameters = analysis.extractedParameters || analysis.parameters || input.extractedParameters || [];
  const abnormalValues = analysis.abnormalValues || input.abnormalValues || [];
  return {
    userId,
    fileName: input.fileName || input.name || 'Uploaded health record',
    name: input.name || input.fileName || 'Uploaded health record',
    fileType: input.fileType || input.type || 'FILE',
    documentType: input.documentType || 'General Medical Document',
    contentExtractionStatus: input.contentExtractionStatus || input.analysis?.extraction?.ocrStatus || '',
    uploadDate: input.uploadDate || input.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    uploadedAt: input.uploadedAt ? new Date(input.uploadedAt) : new Date(),
    fileSize: input.fileSize || input.size || '',
    status: input.status || 'Analyzed',
    analysisSummary: input.analysisSummary || analysis.summary || input.suggestion || '',
    suggestion: input.suggestion || analysis.summary || '',
    riskLevel: input.riskLevel || input.recordRiskLevel || analysis.riskLevel || 'Low',
    recordRiskLevel: input.recordRiskLevel || input.riskLevel || analysis.riskLevel || 'Low',
    recordRiskScore: Number(input.recordRiskScore ?? analysis.reportRiskScore) || 0,
    abnormalValueCount: Number(input.abnormalValueCount ?? abnormalValues.length) || 0,
    extractedParameters,
    abnormalValues,
    analysis
  };
}

router.post('/', async (req, res) => {
  try {
    const userId = currentUserId(req);
    const record = normalizeRecord(req.body || {}, userId);

    if (mongoose.connection.readyState === 1 && req.models?.HealthRecord) {
      const created = await req.models.HealthRecord.create(record);
      return res.status(201).json(toPlain(created));
    }

    const fallback = {
      _id: Math.random().toString(36).slice(2),
      ...record,
      createdAt: new Date()
    };
    memoryRecords.unshift(fallback);
    res.status(201).json(toPlain(fallback));
  } catch (error) {
    console.error('Error saving health record:', error);
    res.status(500).json({ error: 'Failed to save health record' });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (mongoose.connection.readyState === 1 && req.models?.HealthRecord) {
      const records = await req.models.HealthRecord.find({ userId }).sort({ uploadedAt: -1, createdAt: -1 });
      return res.json(records.map(toPlain));
    }
    res.json(memoryRecords.filter((record) => record.userId === userId).map(toPlain));
  } catch (error) {
    console.error('Error fetching health records:', error);
    res.status(500).json({ error: 'Failed to fetch health records' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = currentUserId(req);
    const { id } = req.params;
    if (mongoose.connection.readyState === 1 && req.models?.HealthRecord && mongoose.Types.ObjectId.isValid(id)) {
      const deleted = await req.models.HealthRecord.findOneAndDelete({ _id: id, userId });
      if (!deleted) return res.status(404).json({ error: 'Health record not found' });
      return res.json({ message: 'Health record deleted successfully' });
    }

    const idx = memoryRecords.findIndex((record) => String(record._id || record.id) === String(id) && record.userId === userId);
    if (idx === -1) return res.status(404).json({ error: 'Health record not found' });
    memoryRecords.splice(idx, 1);
    res.json({ message: 'Health record deleted successfully' });
  } catch (error) {
    console.error('Error deleting health record:', error);
    res.status(500).json({ error: 'Failed to delete health record' });
  }
});

module.exports = router;
