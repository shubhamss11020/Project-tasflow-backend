import { Response } from 'express';

interface SSEClient {
  userId: string;
  orgId: string;
  res: Response;
}

export class SSEService {
  private clients: Map<string, SSEClient[]> = new Map(); // orgId -> SSEClient[]

  addClient(orgId: string, userId: string, res: Response) {
    if (!this.clients.has(orgId)) {
      this.clients.set(orgId, []);
    }

    const client: SSEClient = { userId, orgId, res };
    this.clients.get(orgId)!.push(client);

    // Keep connection alive with heartbeat comments
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.removeClient(orgId, res);
    });
  }

  private removeClient(orgId: string, res: Response) {
    const orgClients = this.clients.get(orgId);
    if (orgClients) {
      this.clients.set(
        orgId,
        orgClients.filter((c) => c.res !== res)
      );
    }
  }

  // Broadcast to all active users in an organization
  broadcastToOrg(orgId: string, event: string, data: any) {
    const orgClients = this.clients.get(orgId);
    if (!orgClients || orgClients.length === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    orgClients.forEach((client) => {
      client.res.write(payload);
    });
  }

  // Send to a specific user within an organization
  sendToUser(orgId: string, userId: string, event: string, data: any) {
    const orgClients = this.clients.get(orgId);
    if (!orgClients) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    orgClients
      .filter((c) => c.userId === userId)
      .forEach((client) => {
        client.res.write(payload);
      });
  }
}

export const sseService = new SSEService();
