import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private resendApiKey?: string;
  private smtpHost?: string;
  private smtpPort?: number;
  private smtpUser?: string;
  private smtpPass?: string;
  private smtpSecure?: boolean;
  private fromEmail: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.resendApiKey = process.env.RESEND_API_KEY;
    this.smtpHost = process.env.SMTP_HOST;
    this.smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    this.smtpUser = process.env.SMTP_USER;
    this.smtpPass = process.env.SMTP_PASS;
    this.smtpSecure = process.env.SMTP_SECURE === 'true' || this.smtpPort === 465;
    this.fromEmail = process.env.EMAIL_FROM || 'TaskFlow <notifications@taskflow.dev>';

    this.initTransporter();
  }

  private initTransporter() {
    // If SMTP host and credentials are provided, initialize Nodemailer transporter
    if (this.smtpHost && this.smtpUser && this.smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass
        }
      });
      console.log(`[EmailService] Initialized SMTP Transporter (${this.smtpHost}:${this.smtpPort})`);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId: string; provider: string; preview?: string }> {
    const { to, subject, html, text } = options;

    // 1. SMTP Provider (Nodemailer - Gmail, Mailtrap, Brevo, AWS SES, custom SMTP)
    if (this.transporter || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
      if (!this.transporter) {
        this.initTransporter();
      }

      if (this.transporter) {
        try {
          const info = await this.transporter.sendMail({
            from: this.fromEmail,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>?/gm, '')
          });

          console.log(`[EmailService:SMTP] ✅ Real email sent via SMTP to ${to} (MessageID: ${info.messageId})`);
          return { success: true, messageId: info.messageId, provider: 'smtp' };
        } catch (smtpErr: any) {
          console.error(`[EmailService:SMTP Error] Failed sending to ${to}:`, smtpErr.message);
          throw smtpErr;
        }
      }
    }

    // 2. Resend API Provider (if configured)
    if (this.resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: [to],
            subject,
            html,
            text: text || html.replace(/<[^>]*>?/gm, '')
          })
        });

        const data: any = await response.json();
        if (response.ok) {
          console.log(`[EmailService:Resend] Email delivered to ${to} (ID: ${data.id})`);
          return { success: true, messageId: data.id, provider: 'resend' };
        }
      } catch (err: any) {
        console.error('[EmailService:Resend Error]', err.message);
      }
    }

    // 3. Dev Mock / Console Transporter
    const mockId = `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ [EMAIL NOTIFICATION DISPATCHED - DEV MOCK]                                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ To:       ${to.padEnd(64)}║
║ Subject:  ${subject.padEnd(64)}║
║ Provider: Dev Mock (Configure SMTP_HOST & SMTP_USER in .env for real mail)║
║ ID:       ${mockId.padEnd(64)}║
╚═══════════════════════════════════════════════════════════════════════════╝
    `);

    return { success: true, messageId: mockId, provider: 'mock' };
  }

  // HTML Template Generators
  generateMemberInviteTemplate(data: { orgName: string; inviteeName: string; inviterName: string; role: string }) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #4f46e5; margin-top: 0;">You're Invited to Join ${data.orgName}</h2>
        <p>Hi <strong>${data.inviteeName}</strong>,</p>
        <p><strong>${data.inviterName}</strong> has invited you to collaborate in <strong>${data.orgName}</strong> on the TaskFlow Project Management Dashboard as a <strong>${data.role}</strong>.</p>
        <div style="margin: 25px 0;">
          <a href="http://localhost:3000/api-docs" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Access Workspace</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">TaskFlow Automated Notification</p>
      </div>
    `;
  }

  generateTaskAssignmentTemplate(data: { taskTitle: string; taskId: string; assigneeName: string; assignerName: string; projectName: string }) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #2563eb; margin-top: 0;">New Task Assigned: ${data.taskTitle}</h2>
        <p>Hi <strong>${data.assigneeName}</strong>,</p>
        <p><strong>${data.assignerName}</strong> assigned you to task <strong>"${data.taskTitle}"</strong> in project <strong>${data.projectName}</strong>.</p>
        <div style="margin: 25px 0;">
          <a href="http://localhost:3000/tasks/${data.taskId}" style="background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Task Details</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">TaskFlow Automated Notification</p>
      </div>
    `;
  }

  generateTaskUpdateTemplate(data: { taskTitle: string; taskId: string; updaterName: string; changes: Record<string, any> }) {
    const changesList = Object.entries(data.changes)
      .map(([field, val]) => `<li><strong>${field}:</strong> ${JSON.stringify(val)}</li>`)
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #0284c7; margin-top: 0;">Task Updated: ${data.taskTitle}</h2>
        <p><strong>${data.updaterName}</strong> updated task <strong>"${data.taskTitle}"</strong>:</p>
        <ul>${changesList}</ul>
        <div style="margin: 25px 0;">
          <a href="http://localhost:3000/tasks/${data.taskId}" style="background: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Task</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">TaskFlow Automated Notification</p>
      </div>
    `;
  }

  generateCommentTemplate(data: { taskTitle: string; taskId: string; authorName: string; commentContent: string }) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #059669; margin-top: 0;">New Comment on "${data.taskTitle}"</h2>
        <p><strong>${data.authorName}</strong> wrote:</p>
        <blockquote style="background: #f8fafc; border-left: 4px solid #059669; padding: 12px; margin: 15px 0; color: #334155;">
          ${data.commentContent}
        </blockquote>
        <div style="margin: 25px 0;">
          <a href="http://localhost:3000/tasks/${data.taskId}" style="background: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reply to Comment</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">TaskFlow Automated Notification</p>
      </div>
    `;
  }
}

export const emailService = new EmailService();
