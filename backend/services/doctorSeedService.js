const Doctor = require('../models/Doctor');

const seedDoctors = [
  {
    name: 'Dr. Rahul Sharma',
    specialization: 'General Physician',
    experience: 11,
    clinicName: 'CityCare Medical Centre',
    location: 'Andheri West',
    city: 'Mumbai',
    rating: 4.8,
    reviewsCount: 284,
    availableDays: ['Monday', 'Wednesday', 'Friday'],
    availableSlots: ['09:30 AM', '11:00 AM', '04:30 PM'],
    consultationFee: 700,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-rahul-sharma'
  },
  {
    name: 'Dr. Priya Menon',
    specialization: 'Cardiologist',
    experience: 14,
    clinicName: 'HeartFirst Clinic',
    location: 'Bandra Kurla Complex',
    city: 'Mumbai',
    rating: 4.9,
    reviewsCount: 341,
    availableDays: ['Tuesday', 'Thursday', 'Saturday'],
    availableSlots: ['10:00 AM', '01:30 PM', '05:00 PM'],
    consultationFee: 1200,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-priya-menon'
  },
  {
    name: 'Dr. Arjun Verma',
    specialization: 'Pediatrician',
    experience: 9,
    clinicName: 'Little Steps Child Clinic',
    location: 'Powai',
    city: 'Mumbai',
    rating: 4.7,
    reviewsCount: 219,
    availableDays: ['Monday', 'Tuesday', 'Thursday'],
    availableSlots: ['09:00 AM', '12:00 PM', '06:00 PM'],
    consultationFee: 650,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-arjun-verma'
  },
  {
    name: 'Dr. Nisha Kapoor',
    specialization: 'Dermatologist',
    experience: 8,
    clinicName: 'DermaGlow Skin Studio',
    location: 'Indiranagar',
    city: 'Bengaluru',
    rating: 4.6,
    reviewsCount: 176,
    availableDays: ['Wednesday', 'Friday', 'Saturday'],
    availableSlots: ['10:30 AM', '03:00 PM', '07:00 PM'],
    consultationFee: 850,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-nisha-kapoor'
  },
  {
    name: 'Dr. Vikram Iyer',
    specialization: 'Neurologist',
    experience: 16,
    clinicName: 'NeuroCare Institute',
    location: 'Anna Nagar',
    city: 'Chennai',
    rating: 4.9,
    reviewsCount: 402,
    availableDays: ['Monday', 'Thursday', 'Saturday'],
    availableSlots: ['11:30 AM', '02:30 PM', '05:30 PM'],
    consultationFee: 1400,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-vikram-iyer'
  },
  {
    name: 'Dr. Meera Sethi',
    specialization: 'Orthopedic',
    experience: 13,
    clinicName: 'JointMotion Orthopedic Centre',
    location: 'Saket',
    city: 'Delhi',
    rating: 4.7,
    reviewsCount: 265,
    availableDays: ['Tuesday', 'Wednesday', 'Friday'],
    availableSlots: ['09:45 AM', '01:00 PM', '04:00 PM'],
    consultationFee: 950,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-meera-sethi'
  },
  {
    name: 'Dr. Kabir Khan',
    specialization: 'ENT',
    experience: 10,
    clinicName: 'ClearHear ENT Clinic',
    location: 'Jubilee Hills',
    city: 'Hyderabad',
    rating: 4.5,
    reviewsCount: 198,
    availableDays: ['Monday', 'Wednesday', 'Saturday'],
    availableSlots: ['10:15 AM', '12:45 PM', '06:15 PM'],
    consultationFee: 750,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-kabir-khan'
  },
  {
    name: 'Dr. Ananya Rao',
    specialization: 'Gynecologist',
    experience: 12,
    clinicName: 'WomenFirst Health Clinic',
    location: 'Koramangala',
    city: 'Bengaluru',
    rating: 4.8,
    reviewsCount: 312,
    availableDays: ['Tuesday', 'Thursday', 'Friday'],
    availableSlots: ['09:15 AM', '02:00 PM', '05:45 PM'],
    consultationFee: 1000,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-ananya-rao'
  },
  {
    name: 'Dr. Sameer Joshi',
    specialization: 'General Physician',
    experience: 7,
    clinicName: 'Everyday Health Clinic',
    location: 'Aundh',
    city: 'Pune',
    rating: 4.4,
    reviewsCount: 143,
    availableDays: ['Monday', 'Tuesday', 'Saturday'],
    availableSlots: ['08:30 AM', '11:45 AM', '07:15 PM'],
    consultationFee: 550,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-sameer-joshi'
  },
  {
    name: 'Dr. Kavya Reddy',
    specialization: 'Cardiologist',
    experience: 15,
    clinicName: 'PulsePoint Cardiac Care',
    location: 'Gachibowli',
    city: 'Hyderabad',
    rating: 4.8,
    reviewsCount: 287,
    availableDays: ['Wednesday', 'Friday', 'Saturday'],
    availableSlots: ['10:45 AM', '01:15 PM', '04:45 PM'],
    consultationFee: 1300,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-kavya-reddy'
  },
  {
    name: 'Dr. Rohan Das',
    specialization: 'Dermatologist',
    experience: 6,
    clinicName: 'SkinSense Clinic',
    location: 'Salt Lake',
    city: 'Kolkata',
    rating: 4.5,
    reviewsCount: 121,
    availableDays: ['Monday', 'Thursday', 'Saturday'],
    availableSlots: ['09:30 AM', '03:30 PM', '06:30 PM'],
    consultationFee: 700,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-rohan-das'
  },
  {
    name: 'Dr. Farah Ali',
    specialization: 'Pediatrician',
    experience: 10,
    clinicName: 'HappyKids Pediatric Care',
    location: 'Vasant Kunj',
    city: 'Delhi',
    rating: 4.7,
    reviewsCount: 204,
    availableDays: ['Tuesday', 'Thursday', 'Sunday'],
    availableSlots: ['09:00 AM', '12:30 PM', '05:00 PM'],
    consultationFee: 750,
    verified: true,
    imageUrl: 'https://i.pravatar.cc/160?u=doctor-farah-ali'
  }
];

async function seedDoctorsIfEmpty() {
  const count = await Doctor.countDocuments();
  if (count > 0) return { inserted: 0 };

  const inserted = await Doctor.insertMany(seedDoctors);
  return { inserted: inserted.length };
}

module.exports = {
  seedDoctors,
  seedDoctorsIfEmpty
};
