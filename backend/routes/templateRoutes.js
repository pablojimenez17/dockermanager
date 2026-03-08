import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/', authMiddleware, (req, res) => {
    try {
        const templatesPath = path.join(__dirname, '../data/templates.json');
        const templatesData = fs.readFileSync(templatesPath, 'utf8');
        const templates = JSON.parse(templatesData);
        res.json(templates);
    } catch (error) {
        console.error('Error reading templates:', error);
        res.status(500).json({ message: 'Error loading templates' });
    }
});

export default router;
