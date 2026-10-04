import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { ticketService, type TicketStatus, type TicketIssueType, type TicketPriority } from './server/ticketService.ts';
import { policyService } from './server/policyService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const createTicketDeclaration = {
  name: 'createITTicket',
  description:
    'Create an official IT support ticket in the backend service for hardware or software issues when requested by an employee.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      issueType: {
        type: Type.STRING,
        description: "The category of issue: 'hardware' or 'software'.",
      },
      title: {
        type: Type.STRING,
        description: 'A brief, clear title or summary of the issue.',
      },
      description: {
        type: Type.STRING,
        description: 'Detailed description of the hardware or software problem.',
      },
      urgency: {
        type: Type.STRING,
        description: "Urgency level: 'low', 'medium', 'high', or 'urgent'.",
      },
    },
    required: ['issueType', 'title', 'description'],
  },
};

const getTicketStatusDeclaration = {
  name: 'getTicketStatus',
  description: 'Lookup the current status and details of an IT support ticket using its Ticket ID.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketId: {
        type: Type.STRING,
        description: "The ticket identifier, e.g. 'TK-2026-089' or 'TK-2026-101'.",
      },
    },
    required: ['ticketId'],
  },
};

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

async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1500): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const msg = err instanceof Error ? err.message : '';
    if ((status === 429 || msg.includes('RESOURCE_EXHAUSTED')) && retries > 0) {
      await new Promise((res) => setTimeout(res, delayMs));
      return callGeminiWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'AI Employee Helpdesk Assistant & Policy Management Backend',
      approvedPoliciesCount: policyService.getApproved().length,
    });
  });

  // ==========================================
  // POLICY MANAGEMENT API (Authorized Admin)
  // ==========================================
  app.get('/api/policies', (req: Request, res: Response) => {
    const showAll = req.query.all === 'true';
    const policies = showAll ? policyService.getAll() : policyService.getApproved();
    res.json({ policies });
  });

  app.get('/api/policies/:id', (req: Request, res: Response) => {
    const policy = policyService.getById(req.params.id);
    if (!policy) {
      res.status(404).json({ error: 'Policy not found.' });
      return;
    }
    res.json({ policy });
  });

  app.post('/api/policies', (req: Request, res: Response) => {
    const { title, category, summary, details, sampleQuestion, isApproved, updatedBy } = req.body ?? {};
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Policy title is required.' });
      return;
    }
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      res.status(400).json({ error: 'Policy summary is required.' });
      return;
    }

    const created = policyService.create({
      title: title.trim(),
      category: typeof category === 'string' && category.trim() ? category.trim() : 'General Policy',
      summary: summary.trim(),
      details: Array.isArray(details) ? details : undefined,
      sampleQuestion: typeof sampleQuestion === 'string' ? sampleQuestion.trim() : undefined,
      isApproved: isApproved !== undefined ? Boolean(isApproved) : true,
      updatedBy: typeof updatedBy === 'string' && updatedBy.trim() ? updatedBy.trim() : 'Priya (Admin)',
    });

    res.status(201).json({ policy: created, message: 'Policy created and published to AI knowledge base.' });
  });

  app.put('/api/policies/:id', (req: Request, res: Response) => {
    const { title, category, summary, details, sampleQuestion, isApproved, updatedBy } = req.body ?? {};

    const updated = policyService.update(req.params.id, {
      title,
      category,
      summary,
      details,
      sampleQuestion,
      isApproved,
      updatedBy: typeof updatedBy === 'string' && updatedBy.trim() ? updatedBy.trim() : 'Priya (Admin)',
    });

    if (!updated) {
      res.status(404).json({ error: 'Policy not found.' });
      return;
    }

    res.json({ policy: updated, message: 'Policy updated. AI chatbot is now using this latest approved version.' });
  });

  app.patch('/api/policies/:id/approval', (req: Request, res: Response) => {
    const { isApproved, updatedBy } = req.body ?? {};
    if (typeof isApproved !== 'boolean') {
      res.status(400).json({ error: 'isApproved boolean is required.' });
      return;
    }

    const updated = policyService.update(req.params.id, {
      isApproved,
      updatedBy: typeof updatedBy === 'string' ? updatedBy.trim() : 'Priya (Admin)',
    });

    if (!updated) {
      res.status(404).json({ error: 'Policy not found.' });
      return;
    }

    res.json({ policy: updated });
  });

  app.delete('/api/policies/:id', (req: Request, res: Response) => {
    const deleted = policyService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Policy not found.' });
      return;
    }
    res.json({ success: true, message: 'Policy deleted and removed from AI knowledge base.' });
  });

  // ==========================================
  // IT TICKET MANAGEMENT API
  // ==========================================
  app.get('/api/tickets', (req: Request, res: Response) => {
    const { status, search, issueType } = req.query;
    const result = ticketService.getAll({
      status: typeof status === 'string' ? status : undefined,
      search: typeof search === 'string' ? search : undefined,
      issueType: typeof issueType === 'string' ? issueType : undefined,
    });
    res.json(result);
  });

  app.get('/api/tickets/:id', (req: Request, res: Response) => {
    const ticket = ticketService.getById(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    res.json({ ticket });
  });

  app.post('/api/tickets', (req: Request, res: Response) => {
    const { title, issueType, description, priority, createdBy } = req.body ?? {};
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Title is required.' });
      return;
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ error: 'Description is required.' });
      return;
    }

    const newTicket = ticketService.create({
      title: title.trim(),
      issueType: issueType === 'hardware' ? 'hardware' : 'software',
      description: description.trim(),
      priority: (priority as TicketPriority) || 'medium',
      createdBy: typeof createdBy === 'string' && createdBy.trim() ? createdBy.trim() : 'Priya',
    });

    res.status(201).json({ ticket: newTicket });
  });

  app.patch('/api/tickets/:id/status', (req: Request, res: Response) => {
    const { status, note } = req.body ?? {};
    if (!status) {
      res.status(400).json({ error: 'Status is required.' });
      return;
    }

    const updated = ticketService.updateStatus(
      req.params.id,
      status as TicketStatus,
      typeof note === 'string' ? note : undefined
    );

    if (!updated) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    res.json({ ticket: updated });
  });

  app.post('/api/tickets/:id/comments', (req: Request, res: Response) => {
    const { author, text } = req.body ?? {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Comment text is required.' });
      return;
    }

    const updated = ticketService.addComment(
      req.params.id,
      typeof author === 'string' && author.trim() ? author.trim() : 'Priya',
      text.trim()
    );

    if (!updated) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    res.json({ ticket: updated });
  });

  app.delete('/api/tickets/:id', (req: Request, res: Response) => {
    const deleted = ticketService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    res.json({ success: true, message: 'Ticket deleted successfully.' });
  });

  // ==========================================
  // MAIN SERVER-SIDE GEMINI CHAT ENDPOINT
  // Automatically uses latest approved policies
  // ==========================================
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

      // 3. Dynamically construct system instructions using the LATEST approved policies
      const currentSystemInstruction = policyService.generateSystemInstruction();

      // 4. Build conversation contents to maintain context while chat is open
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
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

      // 5. Call Gemini on the server with tools enabled
      const initialResponse = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction: currentSystemInstruction,
            temperature: 0.1,
            tools: [{ functionDeclarations: [createTicketDeclaration, getTicketStatusDeclaration] }],
          },
        })
      );

      let finalReplyText: string | undefined = initialResponse.text;
      let createdTicketResult = null;

      // 6. Handle tool call if Gemini invokes the IT ticket service
      const functionCalls = initialResponse.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const toolResponseParts: Array<{
          functionResponse: {
            name: string;
            id?: string;
            response: Record<string, unknown>;
          };
        }> = [];

        for (const call of functionCalls) {
          if (call.name === 'createITTicket') {
            const args = (call.args as {
              issueType?: string;
              title?: string;
              description?: string;
              urgency?: string;
            }) || {};

            const newTicket = ticketService.create({
              title: args.title || 'IT Support Ticket',
              issueType: (args.issueType as TicketIssueType) || 'hardware',
              description: args.description || trimmedMessage,
              priority: (args.urgency as TicketPriority) || 'medium',
              createdBy: 'Priya',
            });

            createdTicketResult = newTicket;

            toolResponseParts.push({
              functionResponse: {
                name: call.name,
                id: call.id,
                response: {
                  success: true,
                  ticketId: newTicket.ticketId,
                  title: newTicket.title,
                  issueType: newTicket.issueType,
                  priority: newTicket.priority,
                  status: newTicket.status,
                  createdAt: newTicket.createdAt,
                  assignedTo: newTicket.assignedTo,
                  createdBy: newTicket.createdBy,
                  message: 'IT support ticket created successfully in the backend service.',
                },
              },
            });
          } else if (call.name === 'getTicketStatus') {
            const args = (call.args as { ticketId?: string }) || {};
            const ticket = ticketService.getById(args.ticketId || '');

            if (ticket) {
              toolResponseParts.push({
                functionResponse: {
                  name: call.name,
                  id: call.id,
                  response: {
                    found: true,
                    ticketId: ticket.ticketId,
                    title: ticket.title,
                    status: ticket.status,
                    issueType: ticket.issueType,
                    priority: ticket.priority,
                    assignedTo: ticket.assignedTo,
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                    commentsCount: ticket.comments.length,
                  },
                },
              });
            } else {
              toolResponseParts.push({
                functionResponse: {
                  name: call.name,
                  id: call.id,
                  response: {
                    found: false,
                    message: `No ticket found with ID ${args.ticketId}.`,
                  },
                },
              });
            }
          }
        }

        if (toolResponseParts.length > 0) {
          const followUpContents = [
            ...contents,
            initialResponse.candidates?.[0]?.content,
            {
              role: 'user',
              parts: toolResponseParts,
            },
          ];

          const followUpResponse = await callGeminiWithRetry(() =>
            ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: followUpContents as unknown as Parameters<typeof ai.models.generateContent>[0]['contents'],
              config: {
                systemInstruction: currentSystemInstruction,
                temperature: 0.1,
                tools: [{ functionDeclarations: [createTicketDeclaration, getTicketStatusDeclaration] }],
              },
            })
          );

          finalReplyText = followUpResponse.text;
        }
      }

      // 7. Handle unexpected empty response from Gemini
      if (typeof finalReplyText !== 'string' || finalReplyText.trim().length === 0) {
        res.status(502).json({
          error:
            'Received an unexpected empty response from the AI service. Please try asking your question again.',
          code: 'UNEXPECTED_RESPONSE',
        });
        return;
      }

      res.json({
        reply: finalReplyText.trim(),
        timestamp: new Date().toISOString(),
        createdTicket: createdTicketResult,
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
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'API endpoint not found.',
      code: 'NOT_FOUND',
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Employee Helpdesk Assistant running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
