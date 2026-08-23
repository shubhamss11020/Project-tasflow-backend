import { Router, Request, Response, NextFunction } from 'express';
import { emailService } from '../../common/utils/emailService';

const router = Router();

/**
 * POST /email/test
 * Test sending a real email via SMTP (Gmail, Mailtrap, Brevo, AWS SES, etc.)
 */
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, subject, message } = req.body;

    if (!to) {
      return res.status(400).json({
        error: 'Recipient email address "to" is required',
        code: 'MISSING_RECIPIENT',
        details: {}
      });
    }

    const emailSubject = subject || 'TaskFlow SMTP Email Delivery Test';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #4f46e5; margin-top: 0;">TaskFlow SMTP Test Email</h2>
        <p>Hello,</p>
        <p>${message || 'Your SMTP email configuration in TaskFlow is working perfectly!'}</p>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #334155; margin: 20px 0;">
          Status: Verified Connected<br />
          Timestamp: ${new Date().toISOString()}<br />
          System: TaskFlow Backend Engine
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">TaskFlow Automated Email Delivery System</p>
      </div>
    `;

    const result = await emailService.sendEmail({
      to,
      subject: emailSubject,
      html: emailHtml
    });

    return res.status(200).json({
      success: true,
      message: `Email dispatched successfully to ${to}`,
      details: result
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to send email via SMTP',
      code: 'SMTP_DELIVERY_FAILED',
      details: {
        hint: 'Verify your SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env'
      }
    });
  }
});

export const emailRouter = router;
