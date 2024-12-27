const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // Link to User model for sender
  senderProfile: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },  // Add other fields like phone if needed
    textMessage: { type: String },  // Add other fields like phone if needed
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    altitude: { type: Number },
    speed: { type: Number },
    bearing: { type: Number },
  },
  emergencyEmails: [{ type: String, required: true }],  // List of emergency email addresses
  adminProfiles: [
    { 
      name: { type: String },
      email: { type: String },
      phone: { type: String },  // Add admin's phone or other info
    }
  ],  // Profiles of admins who receive the alert
  status: { type: String, enum: ['sent', 'failed'], required: true },  // Status of the email
  createdAt: { type: Date, default: Date.now },
  photoUri: { type: String },  // Add the photo field to store the photo URL
  message:{type: String}

});

const EmergencyAlert = mongoose.model('EmergencyAlert', emergencyAlertSchema);

module.exports = EmergencyAlert;
