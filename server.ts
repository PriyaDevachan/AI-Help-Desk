import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Content } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const APPROVED_KNOWLEDGE_SYSTEM_INSTRUCTION = `You are the "AI Employee Helpdesk Assistant", an internal company helpdesk assistant that answers employee questions about company policies and support processes.

APPROVED COMPANY KNOWLEDGE:

LEAVE POLICY:
Employees receive 12 casual leaves per calendar year.

WORK FROM HOME POLICY:
Employees may work from home for up to 5 days per month.

MEDICAL REIMBURSEMENT POLICY:
Employees must submit:
- Medical bill
- Prescription
- Reimbursement form

CORPORATE PASSWORD POLICY:
Employees can reset their corporate password through the IT self-service portal.

IT SUPPORT POLICY:
Employees can create an IT support ticket for hardware or software issues.

STRICT BEHAVIORAL RULES:
1. Answer employee questions clearly, concisely, and professionally using ONLY the APPROVED COMPANY KNOWLEDGE provided above.
2. NEVER invent company policies.
3. NEVER make up information, numbers, procedures, URLs, or rules that are not explicitly in the approved knowledge above.
4. If the answer to an employee's question cannot be found in the approved knowledge above (for example, questions about sick leave, maternity/paternity leave, carry-forward leaves, salary, bonuses, office timings, dress code, travel reimbursement, health insurance coverage limits, or general world knowledge), you MUST respond with this exact sentence:
"I don't have enough information in the approved company knowledge base."
5. IT TICKET CREATION RULE: Do NOT claim that an IT ticket has been created, logged, or submitted because no real ticket system is connected yet. If an employee asks you to create, open, file, or submit an IT support ticket (or asks you to log a ticket for their hardware/software issue), explicitly explain that the ticket functionality is not connected yet, and mention that per the IT Support Policy, employees can create an IT support ticket for hardware or software issues.
6. Maintain conversation context across messages while strictly adhering to the approved company knowledge base.
7. If an employee simply greets you (e.g., "Hello", "Hi") or asks what topics you can help with, politely introduce yourself as the AI Employee Helpdesk Assistant and list the five approved policy topics you can answer questions about: Leave Policy, Work From Home Policy, Medical Reimbursement Policy, Corporate Password Policy, and IT Support Policy.`;

interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'AI Employee Helpdesk Assistant' });
  });

  // Main server-side Gemini chat endpoint
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message, history } = req.body ?? {};

      // 1. Validate empty or invalid user input
      if (typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
          error: 'Please enter a question before sending.',
          code: 'EMPTY_INPUT',
        });
        return;
      }

      const trimmedMessage = message.trim();

      // 2. Initialize server-side Gemini client
      let ai: GoogleGenAI;
      try {
        ai = getGenAIClient();
      } catch {
        res.status(500).json({
          error:
            'Gemini API key is not configured on the server. Please check the Settings > Secrets panel.',
          code: 'GEMINI_API_ERROR',
        });
        return;
      }

      // 3. Build conversation contents to maintain context while chat is open
      const contents: Content[] = [];
      if (Array.isArray(history)) {
        for (const item of history as ChatHistoryItem[]) {
          if (
            item &&
            (item.role === 'user' || item.role === 'model') &&
            typeof item.text === 'string' &&
            item.text.trim().length > 0
          ) {
            contents.push({
              role: item.role,
              parts: [{ text: item.text.trim() }],
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: trimmedMessage }],
      });

      // 4. Call Gemini on the server
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: APPROVED_KNOWLEDGE_SYSTEM_INSTRUCTION,
          temperature: 0.1,
        },
      });

      const replyText = response.text;

      // 5. Handle unexpected empty response from Gemini
      if (typeof replyText !== 'string' || replyText.trim().length === 0) {
        res.status(502).json({
          error:
            'Received an unexpected empty response from the AI service. Please try asking your question again.',
          code: 'UNEXPECTED_RESPONSE',
        });
        return;
      }

      res.json({
        reply: replyText.trim(),
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      console.error('Error in /api/chat:', err);

      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      const status = (err as { status?: number })?.status;

      if (
        status === 400 ||
        status === 403 ||
        errorMessage.includes('API_KEY_INVALID') ||
        errorMessage.includes('PERMISSION_DENIED')
      ) {
        res.status(status || 403).json({
          error:
            'Gemini API authentication failed. Please verify the API key in the Settings > Secrets panel.',
          code: 'GEMINI_API_ERROR',
        });
        return;
      }

      if (status === 429 || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({
          error:
            'The AI assistant is temporarily rate-limited (quota exceeded). Please wait a moment and try again.',
          code: 'GEMINI_API_ERROR',
        });
        return;
      }

      if (status === 404 || errorMessage.includes('NOT_FOUND')) {
        res.status(404).json({
          error: 'The requested Gemini model was not found or is unavailable.',
          code: 'GEMINI_API_ERROR',
        });
        return;
      }

      res.status(500).json({
        error:
          'Unable to generate a response from the AI assistant right now. Please try again shortly.',
        code: 'GEMINI_API_ERROR',
      });
    }
  });

  // Catch-all for unknown API routes so they return JSON instead of HTML
  app.all('/api/*splat', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'API endpoint not found.',
      code: 'NOT_FOUND',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*splat', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Employee Helpdesk Assistant running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
