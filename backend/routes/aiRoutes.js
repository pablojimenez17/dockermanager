import express from 'express';
import Docker from 'dockerode';
import authMiddleware from '../middleware/auth.js';
import Container from '../models/Container.js';
import User from '../models/User.js';
import Network from '../models/Network.js';

const router = express.Router();
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

// System Instruction optimized for 0.5b low-parameter LLMs
const getSystemInstruction = (userName) => `You are Orbit AI, the Docker Manager assistant for ${userName}.
CRITICAL RULE: NEVER invent keyboard shortcuts (like Ctrl+C) or command-line codes. ONLY explain how to use the web interface using EXACTLY these rules:

UI ACTIONS DIRECTORY:
* Dashboard: Home page overviews.
* Create Container: Go to "Create Container" to deploy raw images with ports/ENVs.
* Deploy from Git: Go to "Deploy from Git" to paste a GitHub URL and build automatically.
* Templates: Go to "Templates" for 1-click app installs (WordPress, Redis, etc).
* View Containers: Go to "View Containers" to see running apps. From here you can click icons to: Stop, Trash (Delete), Console (Terminal), Logs (>_), Redeploy, and Snapshot (Camera icon).
* Expose to Internet / Proxy: Click the Gear icon on a container in "View Containers" to add a Custom Domain (uses Traefik).
* Snapshots: Go to "Snapshots" to view saved container backups.
* Networks: Go to "Networks" to create Docker bridge networks.
* Buckets: Go to "Buckets" to create S3-compatible cloud storage and upload files.
* Secret Manager: Go to "Secret Manager" to securely store API keys.
* Private Registries: Go to "Private Registries" to link external private Docker registries.
* Billing & Plans: Go to "Billing & Plans" to upgrade account limits.
* Settings: Go to "Settings" to change password or theme.

CONVERSATION RULES:
1. If the user says "Hello" or "Hola", reply ONLY with: "Hello! How can I help you manage your Docker containers today?"
2. If asked something unrelated to Docker, politely say you only know about Docker.
3. Keep answers very short and direct.`;

router.post('/chat', authMiddleware, async (req, res) => {
    try {
        const { message, history } = req.body;
        const userId = req.user.userId;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Fetch user data for personalization
        const user = await User.findById(userId);
        const userName = user?.name || 'Developer';

        // 1. Fetch live contextual data from Docker and filter by User
        let dockerContext = '';
        try {
            // Get user's containers and networks from DB
            const [userContainersList, userNetworksList] = await Promise.all([
                Container.find({ userId }),
                Network.find({ userId })
            ]);

            const userContainerIds = userContainersList.map(c => c.dockerId);
            const userNetworkIds = userNetworksList.map(n => n.dockerId);

            // Get ALL running Docker containers and networks
            const [allContainers, allNetworks] = await Promise.all([
                docker.listContainers({ all: true }),
                docker.listNetworks()
            ]);

            // Filter to only those owned by the current user
            const userDockerContainers = allContainers.filter(c => userContainerIds.includes(c.Id));
            const userDockerNetworks = allNetworks.filter(n => userNetworkIds.includes(n.Id));

            const runningCount = userDockerContainers.filter(c => c.State === 'running').length;
            const containerDetails = userDockerContainers.map(c => `- ${c.Names[0].replace('/', '')} (${c.Image}) - Status: ${c.State}`).join('\n');
            const networkDetails = userDockerNetworks.map(n => {
                const subnet = n.IPAM?.Config?.[0]?.Subnet || 'Auto';
                return `- ${n.Name} (Driver: ${n.Driver}, Subnet: ${subnet})`;
            }).join('\n');

            dockerContext = `
[SYSTEM LIVE CONTEXT - THE FOLLOWING IS THE ACTUAL DOCKER STATE RIGHT NOW]
Total Containers Owned By User: ${userDockerContainers.length}
Running: ${runningCount}

Containers:
${containerDetails || 'No containers currently exist.'}

Available Networks:
${networkDetails || 'No networks found.'}
[END SYSTEM CONTEXT]
`;
        } catch (dockerErr) {
            console.error('Failed to fetch Docker context for AI:', dockerErr);
            dockerContext = '[SYSTEM LIVE CONTEXT: Unable to fetch local Docker state]';
        }

        // 2. Format History for Ollama
        const formattedHistory = (history || []).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.text
        }));

        // 3. User Message
        formattedHistory.push({ role: 'user', content: message });

        // 4. Call Local Ollama via Native REST fetch
        const url = `http://127.0.0.1:11434/api/chat`;

        const requestBody = {
            model: 'qwen2.5:0.5b', // Change this if you decide to pull a different model later
            messages: [
                { role: 'system', content: getSystemInstruction(userName) + `\n\n${dockerContext}` },
                ...formattedHistory
            ],
            stream: false, // Wait for full response
            options: {
                temperature: 0.7
            }
        };

        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Ollama API Error Data:', data);
            throw new Error(data.error || 'Failed to communicate with local Ollama server.');
        }

        // Extract the response text
        const replyText = data.message?.content;

        if (!replyText) {
            throw new Error('Received empty or malformed reply from Local Ollama.');
        }

        res.json({ reply: replyText });
    } catch (error) {
        console.error('AI Chat Error HTTP:', error.message);
        res.status(500).json({ error: error.message || 'Error executing AI request. Check backend console.' });
    }
});

export default router;
