import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/redisConnection';
import { EMAIL_QUEUE_NAME, emailDlqQueue, EmailJobData } from '../queues/emailQueue';
import { emailService } from '../common/utils/emailService';
import { config } from '../config';

console.log('🚀 Initializing TaskFlow Background Email Worker...');

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    console.log(`[Worker] Processing Job ID: ${job.id} (Type: ${job.data.type}, Attempt: ${job.attemptsMade + 1}/3)`);

    const { to, subject, html } = job.data;

    // Simulate transient failure for resilience testing if to address contains 'simulate-fail'
    if (to.includes('simulate-fail') && job.attemptsMade < 2) {
      throw new Error(`Transient delivery failure simulated for ${to}`);
    }

    // Send via Resend / SMTP / Mock transporter
    const result = await emailService.sendEmail({ to, subject, html });

    return {
      success: true,
      deliveredTo: to,
      provider: result.provider,
      messageId: result.messageId,
      processedAt: new Date().toISOString()
    };
  },
  {
    connection: redisConnection,
    concurrency: config.worker.concurrency,
    limiter: {
      max: config.worker.emailRateLimitMax, // 50 emails
      duration: config.worker.emailRateLimitDurationMs // per 1 minute
    }
  }
);

emailWorker.on('completed', (job: Job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

emailWorker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) {
    console.error(`[Worker] Unknown job failure:`, err);
    return;
  }

  console.error(`[Worker] ❌ Job ${job.id} failed attempt ${job.attemptsMade}/${job.opts.attempts || 3}. Reason: ${err.message}`);

  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    console.warn(`[Worker] ⚠️ Moving Job ${job.id} to Dead-Letter Queue (${emailDlqQueue.name}) after 3 exhausted attempts.`);
    try {
      await emailDlqQueue.add('dead-letter-job', {
        originalJobId: job.id,
        queueName: EMAIL_QUEUE_NAME,
        data: job.data,
        failedReason: err.message,
        stacktrace: job.stacktrace,
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade
      });
    } catch (dlqErr) {
      console.error('[Worker] Failed to push job to DLQ:', dlqErr);
    }
  }
});

emailWorker.on('error', (err) => {
  console.error('[Worker] Worker internal error:', err);
});

if (require.main === module) {
  console.log('TaskFlow Worker is running and listening for jobs...');
}
