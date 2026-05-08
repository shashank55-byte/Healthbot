/**
 * Drug Interaction Service to handle detection of potential drug-drug interactions.
 */

class DrugInteractionService {
  constructor() {
    // Sample dataset of common drug interactions
    this.interactions = [
      {
        drugs: ['aspirin', 'warfarin'],
        severity: 'high',
        message: 'Increased risk of bleeding. Consult your doctor immediately.'
      },
      {
        drugs: ['ibuprofen', 'aspirin'],
        severity: 'medium',
        message: 'Ibuprofen may decrease the effectiveness of aspirin for heart protection.'
      },
      {
        drugs: ['amoxicillin', 'methotrexate'],
        severity: 'high',
        message: 'Amoxicillin can increase levels of methotrexate, leading to toxicity.'
      },
      {
        drugs: ['paracetamol', 'alcohol'],
        severity: 'medium',
        message: 'Combined use can increase the risk of liver damage.'
      },
      {
        drugs: ['statin', 'grapefruit juice'],
        severity: 'medium',
        message: 'Grapefruit juice can increase statin levels in the blood, increasing side effects.'
      }
    ];
  }

  /**
   * Check for interactions between a new drug and existing medications.
   * @param {string} newDrugName - The name of the drug being added.
   * @param {Array} existingMeds - List of existing medication names.
   * @returns {Array} List of detected interactions.
   */
  checkInteractions(newDrugName, existingMeds) {
    const detected = [];
    const newDrug = newDrugName.toLowerCase();
    const currentMeds = existingMeds.map(m => m.toLowerCase());

    this.interactions.forEach(interaction => {
      // Check if the new drug is part of this interaction
      if (interaction.drugs.includes(newDrug)) {
        // Check if any of the other drugs in the interaction are in the current medications
        const otherDrugs = interaction.drugs.filter(d => d !== newDrug);
        const conflicts = otherDrugs.filter(d => currentMeds.includes(d));

        if (conflicts.length > 0) {
          detected.push({
            severity: interaction.severity,
            message: interaction.message,
            conflictingWith: conflicts
          });
        }
      }
    });

    return detected;
  }
}

module.exports = new DrugInteractionService();
