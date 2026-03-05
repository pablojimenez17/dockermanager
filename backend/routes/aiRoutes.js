import express from 'express';
import { GoogleGenAI } from '@google/genai';
import Docker from 'dockerode';

const router = express.Router();
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

// Initialize Gemini lazily to ensure dotenv has loaded
let ai = null;

// System Instruction to guide the AI's behavior
const SYSTEM_INSTRUCTION = `You are the Docker Manager AI Assistant. You are a helpful, expert engineer embedded directly into the user's Docker Manager web dashboard. 
Your goal is to answer questions about Docker, containers, deployments, and help the user troubleshoot issues. 
Be concise, friendly, and format your answers with markdown where appropriate (like using code blocks for bash commands). 
When applicable, refer to the user's CURRENT running containers, which will be provided to you in the prompt block.`;

router.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        }

        if (!ai) {
            ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        }

        // 1. Fetch live contextual data from Docker
        let dockerContext = '';
        try {
            const containers = await docker.listContainers({ all: true });
            const runningCount = containers.filter(c => c.State === 'running').length;
            const containerDetails = containers.map(c => `- ${c.Names[0].replace('/', '')} (${c.Image}) - Status: ${c.State}`).join('\n');

            dockerContext = `
[SYSTEM LIVE CONTEXT - THE FOLLOWING IS THE USER'S ACTUAL DOCKER STATE RIGHT NOW]
Total Containers: ${containers.length}
Running: ${runningCount}
List:
${containerDetails || 'No containers currently exist.'}
[END SYSTEM CONTEXT]
`;
        } catch (dockerErr) {
            console.error('Failed to fetch Docker context for AI:', dockerErr);
            dockerContext = '[SYSTEM LIVE CONTEXT: Unable to fetch local Docker state]';
        }

        // 2. Format History for Gemini
        // Gemini expects roles like 'user' or 'model'
        const formattedHistory = (history || []).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

        // 3. Inject Context into the latest message
        const contextualMessage = `${dockerContext}\n\nUser Message: ${message}`;

        // 4. Call Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                ...formattedHistory,
                { role: 'user', parts: [{ text: contextualMessage }] }
            ],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.7,
            }
        });

        res.json({ reply: response.text });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'Failed to communicate with AI Assistant' });
    }
});

export default router;
