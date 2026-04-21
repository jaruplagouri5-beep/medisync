import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import twilio from 'twilio';

import { Record } from './models/Record.js'; 

dotenv.config();

const app = express();

// Enable CORS cleanly before routes
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🟢 MongoDB Connected Successfully'))
    .catch((err) => console.error('🔴 MongoDB Connection Error:', err.message));

// ═══════════════════════════════════════════════════
// 🔥 API KEY ROTATION LOGIC (For Free Tier Limits) 🔥
// ═══════════════════════════════════════════════════

// Load all 4 keys from .env. Filter removes any undefined/empty keys.
const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
].filter(Boolean);

if (GEMINI_KEYS.length === 0) {
    console.error("🔴 NO GEMINI API KEYS FOUND IN .env FILE! Falling back to single key if available.");
    // Fallback in case they only defined GEMINI_API_KEY
    if (process.env.GEMINI_API_KEY) {
        GEMINI_KEYS.push(process.env.GEMINI_API_KEY);
    }
}

let currentKeyIndex = 0;
let ai = new GoogleGenAI({ apiKey: GEMINI_KEYS[currentKeyIndex] }); // Initialize first key

// Helper to switch API Key if Rate Limit (429) hits
function rotateGeminiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
    ai = new GoogleGenAI({ apiKey: GEMINI_KEYS[currentKeyIndex] });
    console.log(`\n⚠️ API Limit Exceeded! Switched to Backup Key ${currentKeyIndex + 1}/${GEMINI_KEYS.length}\n`);
}

// ═══════════════════════════════════════════════════
// GENERAL SETUP
// ═══════════════════════════════════════════════════

const upload = multer({ storage: multer.memoryStorage() });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ═══════════════════════════════════════════════════
// 1 & 2 & 3. CHATBOT, IPFS UPLOAD, & FETCH RECORDS
// ═══════════════════════════════════════════════════

// 🤖 CHATBOT API (With Auto-Retry Logic)
app.post('/api/chat', async (req, res) => {
    const { question, userHealthContext } = req.body;
    let retries = 0;

    while (retries < GEMINI_KEYS.length) {
        try {
            const systemPrompt = `You are MediSync Health Assistant... \n---CONTEXT---\n${userHealthContext}\n---QUERY---\n${question}`;
            const response = await ai.models.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: systemPrompt 
            });
            return res.json({ success: true, reply: response.text + "\n\n⚠️ *This is informational only. Consult your doctor.*" });
        } catch (error) {
            // Check if error is Rate Limit (429) or Quota Exceeded
            if (error.status === 429 || (error.message && error.message.toLowerCase().includes("quota"))) {
                rotateGeminiKey();
                retries++;
            } else {
                console.error("Chatbot Error:", error.message);
                return res.status(500).json({ success: false, message: "AI Server encountered an error. Please try again." });
            }
        }
    }
    // If it breaks out of the loop, all keys are exhausted
    res.status(429).json({ success: false, message: "All AI free tier limits exhausted. Please wait 1 minute." });
});

// 📁 UPLOAD API (With Auto-Retry Logic)
app.post('/api/upload', upload.single('documentImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No image provided" });

    let ipfsHash = "";
    try {
        // 1. PINATA UPLOAD (No limits usually, so no retry loop needed here)
        const pinataData = new FormData();
        pinataData.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });

        const pinataRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", pinataData, {
            headers: { 'Content-Type': `multipart/form-data; boundary=${pinataData._boundary}`, pinata_api_key: process.env.PINATA_API_KEY, pinata_secret_api_key: process.env.PINATA_SECRET_KEY }
        });
        ipfsHash = pinataRes.data.IpfsHash;
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to upload file to IPFS (Pinata)" });
    }

    // 2. GEMINI AI ANALYSIS (With Auto-Retry Loop)
    const prompt = `Analyze this health document image. Extract: 1. Document Name 2. Year (4-digit year, or null). Return EXACTLY as JSON with keys "documentName" and "year".`;
    let retries = 0;
    let extractedData = null;

    while (retries < GEMINI_KEYS.length) {
        try {
            const geminiRes = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    prompt, 
                    { inlineData: { data: req.file.buffer.toString('base64'), mimeType: req.file.mimetype } }
                ],
                config: { responseMimeType: "application/json" }
            });
            extractedData = JSON.parse(geminiRes.text);
            break; // Success! Break out of the retry loop
        } catch (error) {
            if (error.status === 429 || (error.message && error.message.toLowerCase().includes("quota"))) {
                rotateGeminiKey();
                retries++;
            } else {
                console.error("Gemini Vision Error:", error.message);
                return res.status(500).json({ success: false, message: "Failed to analyze document format." });
            }
        }
    }

    if (!extractedData) {
        return res.status(429).json({ success: false, message: "All AI free tier limits exhausted. Please wait 1 minute before uploading." });
    }

    // 3. SAVE TO DB
    try {
        const newRecord = new Record({
            documentName: extractedData.documentName || req.file.originalname,
            year: extractedData.year || new Date().getFullYear().toString(),
            ipfsHash: ipfsHash, 
            ipfsGatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`, 
            category: req.body.category || 'Document' 
        });

        await newRecord.save();
        res.json({ success: true, data: newRecord });
    } catch (error) { 
        res.status(500).json({ success: false, message: "Failed to save record to Database" }); 
    }
});

// Fetch Records
app.get('/api/records', async (req, res) => {
    try {
        const records = await Record.find().sort({ createdAt: -1 }); 
        res.json({ success: true, data: records });
    } catch (error) { 
        res.status(500).json({ success: false, message: "Failed to fetch timeline records" }); 
    }
});

// ═══════════════════════════════════════════════════
// 4. TWILIO EMERGENCY & OTP ACCESS API ENDPOINTS
// ═══════════════════════════════════════════════════

const activeOTPs = {}; // Server memory to hold OTPs temporarily

// 🚨 Send Emergency Alert
app.post("/send-alert", async (req, res) => {
  const { phone, message } = req.body;
  try {
    const response = await twilioClient.messages.create({
      body: message, from: process.env.TWILIO_FROM_NUMBER, to: phone,
    });
    console.log("🚨 Emergency SMS Sent! SID:", response.sid);
    res.json({ success: true, sid: response.sid });
  } catch (err) {
    console.error("Twilio Error on /send-alert:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 👨‍⚕️ Request Access (Generates OTP & Sends SMS)
app.post("/request-access", async (req, res) => {
  const { patientPhone, doctorName, patientId } = req.body;
  
  const otp = Math.floor(1000 + Math.random() * 9000).toString(); // Generate 4 digit OTP
  activeOTPs[patientId] = otp; 

  try {
    const message = `MediSync: ${doctorName} is requesting access to your medical records. Share OTP ${otp} with the doctor to approve.`;
    const response = await twilioClient.messages.create({
      body: message, from: process.env.TWILIO_FROM_NUMBER, to: patientPhone,
    });
    console.log(`📱 OTP ${otp} sent for Patient ${patientId}`);
    res.json({ success: true, message: "OTP sent to patient." });
  } catch (err) {
    console.error("Twilio Error on /request-access:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔐 Verify OTP
app.post("/verify-otp", (req, res) => {
  const { patientId, enteredOtp } = req.body;
  if (activeOTPs[patientId] && activeOTPs[patientId] === enteredOtp) {
    delete activeOTPs[patientId]; // Clear OTP after use
    res.json({ success: true, message: "Access Granted" });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🚀 MediSync Backend running successfully on http://localhost:${PORT}`);
});