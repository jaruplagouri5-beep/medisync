// backend/document-service.js
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

// IPFS & Gemini Extraction Route
router.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // 1. IPFS Upload via Pinata
        const pinataData = new FormData();
        pinataData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const pinataRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", pinataData, {
            headers: {
                'Content-Type': `multipart/form-data; boundary=${pinataData._boundary}`,
                pinata_api_key: process.env.PINATA_API_KEY,
                pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
            }
        });
        
        const ipfs_cid = pinataRes.data.IpfsHash;

        // 2. Gemini Multimodal Vision Extraction
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype
            }
        };

        const prompt = `
            Extract document metadata. Return EXACTLY as JSON with:
            "doc_type" (e.g., Blood Test, Prescription),
            "date" (YYYY-MM-DD or null),
            "ai_summary" (1 sentence summary).
        `;

        const geminiRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [prompt, imagePart],
            config: { responseMimeType: "application/json" }
        });

        const tagged_metadata = JSON.parse(geminiRes.text);

        // 3. Send response back to frontend 
        res.json({
            success: true,
            ipfs_cid: ipfs_cid,
            metadata: tagged_metadata
        });

    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to process document" });
    }
});

export default router;