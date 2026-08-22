import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './redisConnection';

export interface EmailJobData {
  type: 'MEMBER_INVITED' | 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'COMMENT_ADDED' | string;
  to: string;
  subject: string;
  html: string;
  metadata?: Record<string, any>;
}

export const EMAIL_QUEUE_NAME = 'email-notifications';
export const EMAIL_DLQ_NAME = 'email-notifications-dlq';

// Main email queue with global rate limiting (50 emails/min bonus)
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000 // 1s -> 2s -> 4s
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000
    },
    removeOnFail: false
  }
});

// Dead-letter queue
export const emailDlqQueue = new Queue(EMAIL_DLQ_NAME, {
  connection: redisConnection
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConnection
});

/**
 * Enqueue a task assignment email notification with 5-second deduplication
 */
export async function enqueueTaskAssignmentEmail(data: {
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assigneeEmail: string;
  assigneeName: string;
  assignerName: string;
  projectName?: string;
  orgId: string;
  assignedAt: string;
}) {
  const { emailService } = await import('../common/utils/emailService');
  const html = emailService.generateTaskAssignmentTemplate({
    taskTitle: data.taskTitle,
    taskId: data.taskId,
    assigneeName: data.assigneeName,
    assignerName: data.assignerName,
    projectName: data.projectName || 'TaskFlow Project'
  });

  const timeWindow = Math.floor(Date.now() / 5000);
  const jobId = `assignment-${data.taskId}-${data.assigneeId}-${timeWindow}`;

  const job = await emailQueue.add(
    'sendEmailNotification',
    {
      type: 'TASK_ASSIGNED',
      to: data.assigneeEmail,
      subject: `New Task Assigned: ${data.taskTitle}`,
      html,
      metadata: data
    },
    { jobId }
  );

  return job;
}
