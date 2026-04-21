import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
    documentName: { type: String, required: true },
    year: { type: String },
    ipfsHash: { type: String, required: true },
    ipfsGatewayUrl: { type: String, required: true },
    category: { type: String, default: 'Document' }
}, { timestamps: true }); // timestamps true isthe upload ayina date/time adhe save cheskuntundi

export const Record = mongoose.model('Record', recordSchema);