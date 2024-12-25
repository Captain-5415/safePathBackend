const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");

const nodemailer = require("nodemailer");
require("dotenv").config();
const EmergencyAlert = require("./models/EmergencyAlert.model"); // Import the model

const jwt = require("jsonwebtoken");
const app = express();
app.use(bodyParser.json()); // Add this line for JSON data parsing
const http = require("http");

const port = 8080;
const cors = require("cors");
const corsOptions = {
  origin: 'http://196.162.1.21:8080', 
  optionsSuccessStatus: 200, 
};
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
const MONGO_URL = process.env.MONGO_URL;
const password = process.env.Email_passWord;

mongoose.set("strictQuery", true);
mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true, // Removed deprecated option
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error(
      "❌ Error connecting to MongoDB. Check if your IP is whitelisted.",
      err.message
    );
  });

const User = require("./models/user.model");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "gowtham996644@gmail.com", // Replace with your Gmail address
    pass: process.env.password, // This should be your Gmail App Password
  },
});

const sendVerificationEmail = async (email, verificationToken) => {
  const mailOptions = {
    from: "SafePath",
    to: email,
    subject: "Email verification",
    text: `Please click the following link to verify your email: http://localhost:8000/verify/${verificationToken}`,
  };

  // Sending the email
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("Error sending the verification email", error);
  }
};

app.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body; // Accept role in the request body
    console.log("Incoming data:", req.body);

    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Validate the role (allow only 'admin' or 'user')
    if (role && !["admin", "user"].includes(role)) {
      return res.status(400).json({ message: "Invalid role provided" });
    }

    // Create a new user with the specified or default role
    const newUser = new User({
      name,
      email,
      password,
      role: role || "user", // Default to "user" if role is not provided
    });

    // Generate and store the verification token
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    // Save the user to the database
    await newUser.save();

    // Send a verification email
    await sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(201).json({
      message:
        "Registration successful. Please check your email for verification.",
    });
  } catch (error) {
    console.log("Error during registration:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});


// Endpoint to verify the email..
app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;

    // Find the user with the given verification Token
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).json({ message: "Invalid verification Token" });
    }

    // Mark the user as verified...
    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Email verification failed" });
  }
});

const generateSecretKey = () => {
  const secretKey = crypto.randomBytes(32).toString("hex");
  return secretKey;
};

const secretKey = generateSecretKey();



app.post("/login", async (req, res) => {
  try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user || user.password !== password) {
          return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign({ userId: user._id, role: user.role }, secretKey);

      res.status(200).json({ token, role: user.role, message: "Login successful" });
  } catch (error) {
      res.status(500).json({ message: "Login failed" });
  }
});


// Endpoint to get user profile with token passed in the request body
app.post("/userProfile", async (req, res) => {
  try {
    const { token } = req.body;

    // Validate token
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Verify the token
    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        // If token is expired or invalid
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ user });
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving user profile" });
  }
});

// Endpoint to update emergency contact phone numbers and message
app.post("/updatePhones", async (req, res) => {
  try {
    const { token, phones, message } = req.body;

    // Validate token
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Validate phones array (must contain exactly 4 phone numbers)
    if (!phones || phones.length !== 4) {
      return res
        .status(400)
        .json({ message: "You must provide exactly 4 phone numbers" });
    }

    // Validate message (message should be a string)
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "A valid message is required" });
    }

    // Verify the token
    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update the user's emergency contacts
      user.emergencyContacts = { phones, message };

      await user.save();

      res.status(200).json({
        message: "Emergency contact emails and message updated successfully",
      });
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating emergency contact phones and message" });
  }
});

app.post("/sendEmergencyEmail", async (req, res) => {
  const { token, location, emergencyEmails, photoUri } = req.body;

  // Validate that the token is provided
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  // Validate that location is provided
  if (!location || !location.latitude || !location.longitude) {
    return res.status(400).json({ message: "Valid location is required" });
  }

  // Validate that emergencyEmails is an array
  if (!Array.isArray(emergencyEmails) || emergencyEmails.length === 0) {
    return res.status(400).json({ message: "At least one emergency email is required" });
  }

  // Verify the token
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const { latitude, longitude, altitude, speed, bearing } = location;

    // Retrieve the sender's profile
    const sender = await User.findById(decoded.userId);
    if (!sender) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create the email content
    const emailContent = `
      <h1>Emergency Alert</h1>
      <p>${sender.name}</p>
      <p>${sender.email}</p>
      <p>${sender?.textMessage}</p>
      <p><strong>Location Details:</strong></p>
      <ul>
        <li>Latitude: ${latitude}</li>
        <li>Longitude: ${longitude}</li>
        <li>Altitude: ${altitude}</li>
        <li>Speed: ${speed}</li>
        <li>Bearing: ${bearing}</li>
      </ul>`;

    try {
      // Send the email to each emergency contact (admin)
      const mailPromises = emergencyEmails.map((email) => {
        return transporter.sendMail({
          from: "nagasaitac143@gmail.com", 
          to: email,
          subject: "Emergency Location Alert",
          html: emailContent,
        });
      });

      // Wait for all emails to be sent
      await Promise.all(mailPromises);

      // Save the emergency alert data to the database, including the photo as a string
      const emergencyAlert = new EmergencyAlert({
        userId: decoded.userId,
        senderProfile: {
          name: sender.name,
          email: sender.email,
          phone: sender.phone,
        },
        location: {
          latitude,
          longitude,
          altitude,
          speed,
          bearing,
        },
        emergencyEmails,
        adminProfiles: emergencyEmails.map((email) => ({
          email,
          name: "Admin",
          phone: "Not Provided",
        })),
        status: "sent",
        photoUri: photoUri,  // Store the photo as Base64 string in the database
      });

      await emergencyAlert.save();

      res.status(200).send({ message: "Emails sent and alert saved successfully" });
    } catch (error) {
      console.error("Error sending emails:", error);

      // Save the failed alert in the database with 'failed' status
      const emergencyAlert = new EmergencyAlert({
        userId: decoded.userId,
        senderProfile: {
          name: sender.name,
          email: sender.email,
          phone: sender.phone,
        },
        location: {
          latitude,
          longitude,
          altitude,
          speed,
          bearing,
        },
        emergencyEmails,
        adminProfiles: emergencyEmails.map((email) => ({
          email,
          name: "Admin",
          phone: "Not Provided",
        })),
        status: "failed",
        photoUri: photoUri,  // Store the photo as Base64 string in case of failure
      });

      await emergencyAlert.save();

      res.status(500).send({ message: "Error sending emails, alert saved as failed" });
    }
  });
});


// In your Express backend (server.js)

app.post('/getEmergencyAlerts', async (req, res) => {
  try {
    const { token } = req.body;

    // Verify the token
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Verify the token and get the user ID
    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      } 
      const testing  = await EmergencyAlert.find();
      console.log(testing)

      // Fetch the emergency alerts related to the user
      const emergencyAlerts = await EmergencyAlert.find().sort({ createdAt: -1 }); // Sort by the most recent alert first
      console.log(emergencyAlerts)
      // Return the fetched alerts
      res.status(200).json({ alerts: emergencyAlerts });
    });
  } catch (error) {
    console.log("Error fetching emergency alerts:", error);
    res.status(500).json({ message: 'Error fetching emergency alerts' });
  }
});

// Endpoint to get all users except admins
app.post("/getUsers", async (req, res) => {
  console.log("getusers")
  const { token } = req.body;

  // Validate token
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  // Verify the token and get the decoded user data
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Check if the user is an admin
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      // Fetch all users where the role is not 'admin'
      const users = await User.find({ role: { $ne: "admin" } });

      // Return the list of users
      res.status(200).json({ users });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });
});





app.listen(port, () => {
  console.log("Server is running on port 8080");
});
