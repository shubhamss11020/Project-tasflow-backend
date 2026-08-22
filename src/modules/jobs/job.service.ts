import { emailQueue, emailDlqQueue } from '../../queues/emailQueue';
import { NotFoundError } from '../../common/errors/AppError';

export class JobService {
  async getJobStatus(jobId: string) {
    // 1. Check main queue
    const job = await emailQueue.getJob(jobId);

    if (job) {
      const state = await job.getState();
      let normalizedStatus: 'pending' | 'active' | 'completed' | 'failed' = 'pending';

      if (state === 'active') {
        normalizedStatus = 'active';
      } else if (state === 'completed') {
        normalizedStatus = 'completed';
      } else if (state === 'failed') {
        normalizedStatus = 'failed';
      } else {
        // waiting, delayed, waiting-children, prioritized -> pending
        normalizedStatus = 'pending';
      }

      return {
        id: job.id,
        name: job.name,
        queue: 'email-notifications',
        status: normalizedStatus,
        rawState: state,
        data: job.data,
        result: job.returnvalue || null,
        failedReason: job.failedReason || null,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts || 3,
        createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
      };
    }

    // 2. Check dead letter queue
    const dlqJob = await emailDlqQueue.getJob(jobId);
    if (dlqJob) {
      return {
        id: dlqJob.id,
        name: dlqJob.name,
        queue: 'email-notifications-dlq',
        status: 'failed',
        rawState: 'failed',
        data: dlqJob.data,
        result: null,
        failedReason: dlqJob.data.failedReason || 'Moved to dead letter queue after retry exhaustion',
        attemptsMade: dlqJob.data.attemptsMade || 3,
        maxAttempts: 3,
        createdAt: dlqJob.timestamp ? new Date(dlqJob.timestamp).toISOString() : null,
        processedOn: dlqJob.processedOn ? new Date(dlqJob.processedOn).toISOString() : null,
        finishedOn: dlqJob.finishedOn ? new Date(dlqJob.finishedOn).toISOString() : null
      };
    }

    throw new NotFoundError(`Job with ID '${jobId}' not found`, 'JOB_NOT_FOUND');
  }
}

export const jobService = new JobService();
