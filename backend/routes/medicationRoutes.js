const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Optional database connection warning (non-blocking)
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.warn('MongoDB not connected, using in-memory fallback for medications');
  }
  next();
});
const medicationService = require('../services/medicationService');
const drugInteractionService = require('../services/drugInteractionService');

const MEDICATION_TRACKING_DISCLAIMER = 'Medication tracking stores user-entered information only. The system does not recommend, prescribe, start, stop, or change medications.';

function currentUserId(req) {
  return req.user?.id || req.body.userId || req.query.userId || 'demo';
}

/**
 * POST /api/medications
 * Add a medication
 * Input: name, dosage, frequency, duration, isPrescribed
 */
router.post('/', async (req, res) => {
  try {
    const { name, dosage, frequency, duration, isPrescribed } = req.body;
    const userId = currentUserId(req);

    if (!req.models || !req.models.Medication) {
      console.error('Database models missing in request context');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!name || !dosage || !frequency) {
      return res.status(400).json({ error: 'Name, dosage, and frequency are required' });
    }

    // Check for existing medications to detect interactions
    const existingMeds = await medicationService.getMedications(req.models, userId);
    const existingNames = (existingMeds || []).map(m => m.name);
    
    // Safety Alert: Duplicate check
    if (existingNames.some(n => n && n.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'This medication is already in your list.' });
    }

    // Drug Interaction Warning
    const interactions = drugInteractionService.checkInteractions(name, existingNames);

    const medication = await medicationService.addMedication(req.models, {
      userId,
      name,
      dosage,
      frequency,
      duration: duration || '',
      isPrescribed: isPrescribed !== undefined ? isPrescribed : true,
      status: 'active'
    });

    // Handle both Mongoose document and plain object (fallback)
    const result = medication.toObject ? medication.toObject() : { ...medication };
    result.interactions = interactions.length > 0 ? interactions : null;
    result.medication_tracking_disclaimer = MEDICATION_TRACKING_DISCLAIMER;

    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding medication details:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * PATCH /api/medications/:id/log
 * Mark medication as taken
 */
router.patch('/:id/log', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'taken' or 'missed'
    const userId = currentUserId(req);
    
    const medication = await medicationService.logAdherence(req.models, id, status || 'taken', userId);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(medication);
  } catch (error) {
    console.error('Error logging adherence details:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/medications
 * Return all medications for the user
 */
router.get('/', async (req, res) => {
  try {
    const userId = currentUserId(req);
    const medications = await medicationService.getMedications(req.models, userId);
    const result = medications.map((med) => {
      const item = med.toObject ? med.toObject() : { ...med };
      item.medication_tracking_disclaimer = MEDICATION_TRACKING_DISCLAIMER;
      return item;
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/medications/:id
 * Delete a medication
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = currentUserId(req);
    const result = await medicationService.deleteMedication(req.models, id, userId);
    
    if (!result) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json({
      message: 'Medication deleted successfully',
      medication_tracking_disclaimer: MEDICATION_TRACKING_DISCLAIMER
    });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
