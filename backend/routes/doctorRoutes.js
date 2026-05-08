const express = require('express');
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const { seedDoctorsIfEmpty, seedDoctors } = require('../services/doctorSeedService');

const router = express.Router();

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const LIVE_SEARCH_FALLBACK_MESSAGE = 'Live search unavailable. Showing local doctor directory.';

function regexFor(value) {
  return new RegExp(String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

router.get('/live', async (req, res) => {
  const { search = '', specialization = '', city = '', lat, lng } = req.query;
  let overpassQuery = '';
  let overpassStatus = null;
  let geocodedLocation = null;

  try {
    geocodedLocation = await resolveSearchLocation({ city, lat, lng });
    overpassQuery = buildOverpassQuery(geocodedLocation);

    console.log('[doctors:live] Overpass request', {
      requestedCity: city,
      requestedSearch: search,
      requestedSpecialization: specialization,
      requestedLat: lat,
      requestedLng: lng,
      resolvedLocation: geocodedLocation,
      overpassUrl: OVERPASS_API_URL,
      overpassQuery
    });

    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'HealthAI/1.0 (patient-side doctor search)'
      },
      body: new URLSearchParams({ data: overpassQuery })
    });
    overpassStatus = response.status;
    const responseText = await response.text();
    let data = {};
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[doctors:live] Failed to parse Overpass response', {
        requestedCity: city,
        requestedSearch: search,
        overpassUrl: OVERPASS_API_URL,
        overpassQuery,
        overpassStatus,
        responsePreview: responseText.slice(0, 500),
        errorMessage: parseError.message
      });
      return sendLocalDoctorFallback(res, req.query, parseError);
    }

    if (!response.ok || data.remark) {
      console.error('[doctors:live] Overpass API error', {
        requestedCity: city,
        requestedSearch: search,
        overpassUrl: OVERPASS_API_URL,
        overpassQuery,
        overpassStatus,
        errorMessage: data.remark || response.statusText
      });

      return sendLocalDoctorFallback(res, req.query, new Error(data.remark || response.statusText));
    }

    const normalized = (data.elements || [])
      .map((element) => normalizeOsmHealthcareElement(element, { requestedCity: city }))
      .filter(Boolean);
    const doctors = filterLiveDoctors(normalized, { search, specialization });

    console.log('[doctors:live] Returned OpenStreetMap doctors', {
      count: doctors.length,
      rawCount: data.elements?.length || 0
    });

    res.json({
      doctors,
      source: 'OpenStreetMap'
    });
  } catch (error) {
    console.error('[doctors:live] Failed to search OpenStreetMap Overpass', {
      requestedCity: city,
      requestedSearch: search,
      overpassUrl: OVERPASS_API_URL,
      overpassQuery,
      overpassStatus,
      errorMessage: error.message,
      stack: error.stack
    });
    return sendLocalDoctorFallback(res, req.query, error);
  }
});

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error('[doctors:list] MongoDB unavailable', {
        readyState: mongoose.connection.readyState,
        query: req.query
      });

      const fallbackDoctors = filterDoctors(seedDoctors, req.query).map((doctor, index) => ({
        ...doctor,
        _id: `sample-doctor-${index + 1}`,
        seededFallback: true
      }));

      return res.json({
        doctors: fallbackDoctors,
        source: 'sample-fallback',
        message: 'Showing sample doctors while the database connection is unavailable.'
      });
    }

    const { search, specialization, city, availability } = req.query;
    const query = buildDoctorQuery({ search, specialization, city, availability });

    let doctors = await Doctor.find(query).sort({ rating: -1, reviewsCount: -1, name: 1 });
    if (doctors.length === 0) {
      const seedResult = await seedDoctorsIfEmpty();
      if (seedResult.inserted > 0) {
        console.log(`[doctors:list] Seeded ${seedResult.inserted} doctors after empty lookup`);
        doctors = await Doctor.find(query).sort({ rating: -1, reviewsCount: -1, name: 1 });
      }
    }

    console.log(`[doctors:list] Returned ${doctors.length} doctors`, {
      query: req.query,
      dbState: mongoose.connection.readyState
    });
    res.json(doctors);
  } catch (error) {
    console.error('[doctors:list] Failed to fetch doctors', error);
    res.status(500).json({ message: 'Failed to fetch doctors' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (String(req.params.id).startsWith('sample-doctor-')) {
      const index = Number(String(req.params.id).replace('sample-doctor-', '')) - 1;
      const sample = seedDoctors[index];
      if (!sample) {
        return res.status(404).json({ message: 'Doctor not found' });
      }
      return res.json({ ...sample, _id: req.params.id, seededFallback: true });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (error) {
    console.error('[doctors:details] Failed to fetch doctor details', {
      doctorId: req.params.id,
      error
    });
    res.status(500).json({ message: 'Failed to fetch doctor details' });
  }
});

async function resolveSearchLocation({ city, lat, lng }) {
  if (lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return {
      lat: Number(lat),
      lng: Number(lng),
      city: String(city || '').trim()
    };
  }

  const cityName = String(city || '').trim() || 'Delhi';
  const url = `${NOMINATIM_SEARCH_URL}?${new URLSearchParams({
    format: 'json',
    q: cityName,
    limit: '1'
  }).toString()}`;

  console.log('[doctors:live] Nominatim request', {
    requestedCity: cityName,
    url
  });

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'HealthAI/1.0 (patient-side doctor search)'
    }
  });
  const responseText = await response.text();
  let data = [];
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    console.error('[doctors:live] Failed to parse Nominatim response', {
      requestedCity: cityName,
      status: response.status,
      responsePreview: responseText.slice(0, 500),
      errorMessage: error.message
    });
    throw error;
  }

  if (!response.ok || !Array.isArray(data) || data.length === 0) {
    const message = !response.ok
      ? `Nominatim failed with status ${response.status}`
      : `No coordinates found for ${cityName}`;
    console.error('[doctors:live] Nominatim geocode failed', {
      requestedCity: cityName,
      status: response.status,
      errorMessage: message
    });
    throw new Error(message);
  }

  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    city: cityName
  };
}

function buildOverpassQuery({ lat, lng }) {
  const radius = 12000;
  const selectors = [
    '["amenity"="hospital"]',
    '["amenity"="clinic"]',
    '["amenity"="doctors"]',
    '["healthcare"="doctor"]',
    '["healthcare"="clinic"]',
    '["healthcare"="hospital"]'
  ];
  const elementTypes = ['node', 'way', 'relation'];
  const statements = selectors.flatMap((selector) => (
    elementTypes.map((elementType) => `${elementType}${selector}(around:${radius},${lat},${lng});`)
  ));

  return `
    [out:json][timeout:25];
    (
      ${statements.join('\n      ')}
    );
    out center 80;
  `;
}

function normalizeOsmHealthcareElement(element, { requestedCity }) {
  const tags = element.tags || {};
  const name = tags.name || tags['official_name'] || tags['operator'];
  if (!name) return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  const type = inferHealthcareType(tags);
  const address = buildOsmAddress(tags);
  const specialization = tags['healthcare:speciality'] ||
    tags['healthcare:specialty'] ||
    tags.speciality ||
    tags.specialty ||
    '';

  return {
    id: `${element.type}-${element.id}`,
    _id: `${element.type}-${element.id}`,
    name,
    specialization,
    clinicName: name,
    address,
    city: requestedCity || tags['addr:city'] || tags['addr:district'] || '',
    type,
    rating: null,
    reviewsCount: null,
    location: lat && lon ? { lat, lng: lon } : null,
    verified: Boolean(tags.healthcare || tags.amenity),
    source: 'OpenStreetMap',
    availableSlots: []
  };
}

async function getLocalDoctorDirectory(queryParams) {
  const { search, specialization, city, availability } = queryParams;

  try {
    if (mongoose.connection.readyState === 1) {
      const query = buildDoctorQuery({ search, specialization, city, availability });
      let doctors = await Doctor.find(query).sort({ rating: -1, reviewsCount: -1, name: 1 });
      if (doctors.length === 0) {
        const seedResult = await seedDoctorsIfEmpty();
        if (seedResult.inserted > 0) {
          doctors = await Doctor.find(query).sort({ rating: -1, reviewsCount: -1, name: 1 });
        }
      }
      if (doctors.length === 0) {
        doctors = await Doctor.find().sort({ rating: -1, reviewsCount: -1, name: 1 }).limit(12);
      }
      return doctors.map(normalizeLocalDoctor);
    }
  } catch (error) {
    console.error('[doctors:live] Local Mongo fallback failed', {
      errorMessage: error.message
    });
  }

  let fallbackDoctors = filterDoctors(seedDoctors, queryParams);
  if (fallbackDoctors.length === 0) {
    fallbackDoctors = seedDoctors;
  }

  return fallbackDoctors.map((doctor, index) => normalizeLocalDoctor({
    ...doctor,
    _id: `sample-doctor-${index + 1}`
  }));
}

function normalizeLocalDoctor(doctor) {
  const raw = typeof doctor.toObject === 'function' ? doctor.toObject() : doctor;
  return {
    id: String(raw._id),
    _id: String(raw._id),
    name: raw.name,
    address: [raw.clinicName, raw.location, raw.city].filter(Boolean).join(', '),
    city: raw.city || '',
    type: 'Doctor',
    specialization: raw.specialization || '',
    rating: raw.rating ?? null,
    reviewsCount: raw.reviewsCount ?? null,
    clinicName: raw.clinicName || raw.name,
    location: raw.location || null,
    verified: Boolean(raw.verified),
    source: 'Local Directory',
    availableSlots: raw.availableSlots || []
  };
}

async function sendLocalDoctorFallback(res, queryParams, error) {
  const doctors = await getLocalDoctorDirectory(queryParams);
  console.error('[doctors:live] Returning local doctor directory fallback', {
    requestedCity: queryParams.city,
    requestedSearch: queryParams.search,
    errorMessage: error?.message,
    fallbackCount: doctors.length
  });

  return res.json({
    doctors,
    source: 'Local Directory',
    fallback: true,
    message: LIVE_SEARCH_FALLBACK_MESSAGE
  });
}

function inferHealthcareType(tags) {
  const raw = String(tags.healthcare || tags.amenity || '').toLowerCase();
  if (raw.includes('hospital')) return 'Hospital';
  if (raw.includes('doctor') || raw.includes('physician')) return 'Doctor';
  if (raw.includes('clinic')) return 'Clinic';
  if (raw.includes('centre') || raw.includes('center')) return 'Healthcare Center';
  return 'Healthcare Center';
}

function buildOsmAddress(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  return [
    street,
    tags['addr:suburb'],
    tags['addr:city'] || tags['addr:district'],
    tags['addr:state'],
    tags['addr:postcode']
  ].filter(Boolean).join(', ');
}

function filterLiveDoctors(doctors, { search, specialization }) {
  const keyword = buildLiveKeyword(search, specialization);
  if (!keyword) return doctors;

  const matched = doctors.filter((doctor) => {
    const haystack = [
      doctor.name,
      doctor.specialization,
      doctor.type,
      doctor.address,
      doctor.city
    ].join(' ').toLowerCase();
    return haystack.includes(keyword);
  });

  return matched.length > 0 ? matched : doctors;
}

function buildLiveKeyword(search, specialization) {
  const category = String(specialization || '').trim();
  if (category && category !== 'All') return category.toLowerCase();

  const text = String(search || '').trim().toLowerCase();
  if (!text || ['doctor', 'doctors', 'clinic', 'hospital', 'healthcare', 'near me'].includes(text)) {
    return '';
  }
  return text;
}

function buildDoctorQuery({ search, specialization, city, availability }) {
  const query = {};

  if (search && String(search).trim()) {
    const pattern = regexFor(search);
    query.$or = [
      { name: pattern },
      { specialization: pattern },
      { clinicName: pattern },
      { city: pattern },
      { location: pattern }
    ];
  }

  if (specialization && specialization !== 'All') {
    query.specialization = regexFor(specialization);
  }

  if (city && city !== 'All') {
    query.city = regexFor(city);
  }

  if (availability && availability !== 'All') {
    query.availableDays = regexFor(availability);
  }

  return query;
}

function filterDoctors(doctors, { search, specialization, city, availability }) {
  const searchTerm = String(search || '').trim().toLowerCase();
  const specializationTerm = String(specialization || '').trim().toLowerCase();
  const cityTerm = String(city || '').trim().toLowerCase();
  const availabilityTerm = String(availability || '').trim().toLowerCase();

  return doctors.filter((doctor) => {
    const matchesSearch = !searchTerm || [
      doctor.name,
      doctor.specialization,
      doctor.clinicName,
      doctor.city,
      doctor.location
    ].some((value) => String(value || '').toLowerCase().includes(searchTerm));

    const matchesSpecialization = !specializationTerm || specializationTerm === 'all' ||
      String(doctor.specialization || '').toLowerCase() === specializationTerm;

    const matchesCity = !cityTerm || cityTerm === 'all' ||
      String(doctor.city || '').toLowerCase() === cityTerm;

    const matchesAvailability = !availabilityTerm || availabilityTerm === 'all' ||
      (doctor.availableDays || []).some((day) => String(day || '').toLowerCase() === availabilityTerm);

    return matchesSearch && matchesSpecialization && matchesCity && matchesAvailability;
  });
}

module.exports = router;
