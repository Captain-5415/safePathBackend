const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["admin", "user"], // Restrict role to "admin" or "user"
        default: "user"          // Default role is "user"
    },
    verified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    emergencyContacts: {
        phones: [
            { type: String }, // Phone 1
            { type: String }, // Phone 2
            { type: String }, // Phone 3
            { type: String }  // Phone 4
        ],
    },
    textMessage: { type: String } // Text message
,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model("User", userSchema);
module.exports = User;
