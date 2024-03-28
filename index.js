const { PubSub } = require("@google-cloud/pubsub");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");
const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Define the model for the email_tracking table
const EmailTracking = sequelize.define("EmailTracking", {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  verification_link: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sent_timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
  },
});

const pubsub = new PubSub();

// Create a Nodemailer transporter using Mailgun
const transporter = nodemailer.createTransport(
  mg({
    auth: {
      api_key: "fb8713444717c7f784b043a3217ac83a-f68a26c9-f30e7306",
      domain: "kashishdesai.me",
    },
  })
);

// Function to send verification email
async function sendVerificationEmail(email, verificationLink) {
  const mailOptions = {
    from: "info@kashishdesai.me", // Replace with your verified email address from Mailgun
    to: "desai.kashi@northeastern.edu",
    subject: "Email Verification",
    html: `Please click <a href="${verificationLink}">here</a> to verify your email.`,
  };

  await transporter.sendMail(mailOptions);
}

// Function to generate a verification link with timestamp
function generateVerificationLink(email) {
  const timestamp = Date.now();
  const verificationLink = `https://example.com/verify?email=${email}&timestamp=${timestamp}`;
  return verificationLink;
}

// Function to verify if the timestamp is within 2 minutes
function isWithinTwoMinutes(timestamp) {
  const currentTime = Date.now();
  return currentTime - timestamp <= 120000; // 120,000 milliseconds = 2 minutes
}

// Cloud Function to handle pub/sub messages
exports.verifyEmailFunction = async (message, context) => {
  const data = JSON.parse(Buffer.from(message.data, "base64").toString());

  // Extract necessary information from the message payload
  const { email, timestamp } = data;

  // Verify if the timestamp is within 2 minutes
  if (!isWithinTwoMinutes(timestamp)) {
    console.error(`Verification link expired for ${email}`);
    return;
  }

  // Generate verification link with timestamp
  const verificationLink = generateVerificationLink(email);

  // Send verification email
  await sendVerificationEmail(email, verificationLink);

  // Track the email sent in CloudSQL instance
  try {
    // Insert email tracking information into the database
    await EmailTracking.create({
      email,
      verification_link: verificationLink,
    });

    console.log(`Email sent to ${email} tracked successfully.`);
  } catch (error) {
    console.error("Error tracking email:", error);
  }

  // Log success message
  console.log(`Verification email sent to ${email}`);
};
