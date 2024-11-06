const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const dotenv = require('dotenv');
const cors = require('cors'); // Import the cors module

dotenv.config();

// Create an instance of Express app
const app = express();
const port = process.env.PORT || 3000;

// Parse incoming JSON requests
app.use(bodyParser.json());

app.use(cors()); // This allows cross-origin requests from any origin

// Twilio client setup
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Temporary in-memory storage for verification codes and timestamps
let verificationCodes = {};

// Utility function to generate a random 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// API to send verification code via SMS
app.post('/send-verification-code', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber || phoneNumber.length !== 10) {
    return res.status(400).send({ message: 'Invalid phone number. Please enter a 10-digit number.' });
  }

  const verificationCode = generateVerificationCode();
  const expirationTime = Date.now() + 2 * 60 * 1000; // 2 minutes expiration time

  // Store the verification code and expiration time in memory
  verificationCodes[phoneNumber] = {
    code: verificationCode,
    expiresAt: expirationTime
  };

  try {
    // Format the phone number to E.164 (including +91 for India)
    const formattedPhoneNumber = `+91${phoneNumber}`;

    // Send SMS using Twilio API
    await client.messages.create({
      body: `Your verification code is: ${verificationCode}`,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
      to: formattedPhoneNumber // Ensure the phone number is in correct format
    });

    res.status(200).send({ message: 'Verification code sent successfully!' });
  } catch (error) {
    // Catching specific Twilio error related to unverified numbers
    if (error.code === 21608) {
      return res.status(400).send({ message: `The number ${phoneNumber} is unverified. Please verify the number first.` });
    }

    console.error('Error sending SMS:', error);
    res.status(500).send({ message: 'Failed to send verification code. Please try again.' });
  }
});

// API to verify the code entered by the user
app.post('/verify-code', (req, res) => {
  const { phoneNumber, code } = req.body;

  // Check if the verification code exists for the phone number
  const storedVerification = verificationCodes[phoneNumber];

  if (!storedVerification) {
    return res.status(400).send({ message: 'No verification code found for this phone number.' });
  }

  // Check if the code has expired
  if (Date.now() > storedVerification.expiresAt) {
    delete verificationCodes[phoneNumber]; // Expired code should be removed
    return res.status(400).send({ message: 'Verification code has expired. Please request a new code.' });
  }

  // Verify the code
  if (storedVerification.code === code) {
    // Successfully verified
    delete verificationCodes[phoneNumber]; // Clean up the stored code after verification
    return res.status(200).send({ message: 'Phone number successfully verified!' });
  } else {
    return res.status(400).send({ message: 'Incorrect verification code.' });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
