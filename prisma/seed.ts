import { PrismaClient, OrgRole, TaskStatus, TaskPriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seeding ---');

  // Clean existing data in reverse order of dependencies
  await prisma.comment.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data.');

  // Common password hashed with cost factor >= 12
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // 1. Create 5 Users
  const user1 = await prisma.user.create({
    data: {
      email: 'alice@acme.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson'
    }
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'bob@acme.com',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Smith'
    }
  });

  const user3 = await prisma.user.create({
    data: {
      email: 'charlie@acme.com',
      passwordHash,
      firstName: 'Charlie',
      lastName: 'Brown'
    }
  });

  const user4 = await prisma.user.create({
    data: {
      email: 'dave@stark.com',
      passwordHash,
      firstName: 'Dave',
      lastName: 'Miller'
    }
  });

  const user5 = await prisma.user.create({
    data: {
      email: 'eve@stark.com',
      passwordHash,
      firstName: 'Eve',
      lastName: 'Davis'
    }
  });

  console.log('Created 5 users.');

  // 2. Create 2 Organizations
  const org1 = await prisma.organization.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corp'
    }
  });

  const org2 = await prisma.organization.create({
    data: {
      name: 'Stark Industries',
      slug: 'stark-ind'
    }
  });

  console.log('Created 2 organizations.');

  // 3. Assign Members to Organizations
  // Org 1: Alice (Admin), Bob (Member), Charlie (Member)
  await prisma.orgMember.createMany({
    data: [
      { organizationId: org1.id, userId: user1.id, role: OrgRole.org_admin },
      { organizationId: org1.id, userId: user2.id, role: OrgRole.member },
      { organizationId: org1.id, userId: user3.id, role: OrgRole.member }
    ]
  });

  // Org 2: Dave (Admin), Eve (Member)
  await prisma.orgMember.createMany({
    data: [
      { organizationId: org2.id, userId: user4.id, role: OrgRole.org_admin },
      { organizationId: org2.id, userId: user5.id, role: OrgRole.member }
    ]
  });

  console.log('Created org memberships.');

  // 4. Create Projects
  const project1 = await prisma.project.create({
    data: {
      organizationId: org1.id,
      name: 'TaskFlow Platform MVP',
      description: 'Core backend and UI development for project management system.',
      createdById: user1.id
    }
  });

  const project2 = await prisma.project.create({
    data: {
      organizationId: org1.id,
      name: 'Acme Mobile App Redesign',
      description: 'iOS and Android client revamp.',
      createdById: user1.id
    }
  });

  const project3 = await prisma.project.create({
    data: {
      organizationId: org2.id,
      name: 'Stark Arc Reactor Cloud API',
      description: 'IoT telemetry ingestion for clean energy grid.',
      createdById: user4.id
    }
  });

  console.log('Created projects.');

  // 5. Create 12 Tasks distributed across projects with various statuses and priorities
  const task1 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Design Multi-Tenant Database Schema',
      description: 'Implement PostgreSQL schema with foreign keys, enums, and indexes.',
      status: TaskStatus.done,
      priority: TaskPriority.urgent,
      dueDate: new Date(Date.now() + 86400000 * 2),
      createdById: user1.id
    }
  });

  const task2 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Implement JWT Authentication & RBAC',
      description: 'Build auth routes with 15m access token, 7d refresh token, and bcrypt cost 12.',
      status: TaskStatus.done,
      priority: TaskPriority.high,
      dueDate: new Date(Date.now() + 86400000 * 3),
      createdById: user1.id
    }
  });

  const task3 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Build Tasks & Projects REST API',
      description: 'CRUD endpoints with filtering, offset and cursor pagination.',
      status: TaskStatus.in_progress,
      priority: TaskPriority.high,
      dueDate: new Date(Date.now() + 86400000 * 5),
      createdById: user1.id
    }
  });

  const task4 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Integrate BullMQ Job Queue with Redis',
      description: 'Asynchronous task assignment email notifications with retry logic and DLQ.',
      status: TaskStatus.review,
      priority: TaskPriority.urgent,
      dueDate: new Date(Date.now() + 86400000 * 4),
      createdById: user1.id
    }
  });

  const task5 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Write Unit and Integration Tests',
      description: 'Comprehensive test suite covering auth, multi-tenancy, and task assignment.',
      status: TaskStatus.todo,
      priority: TaskPriority.medium,
      dueDate: new Date(Date.now() + 86400000 * 7),
      createdById: user1.id
    }
  });

  const task6 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Configure Docker Compose Orchestration',
      description: 'Set up api, worker, postgres, and redis services.',
      status: TaskStatus.todo,
      priority: TaskPriority.low,
      dueDate: new Date(Date.now() + 86400000 * 8),
      createdById: user2.id
    }
  });

  // Tasks for Project 2 (Acme Mobile)
  const task7 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'Create Figma Wireframes for Mobile App',
      description: 'Modern glassmorphism mobile UI mockups.',
      status: TaskStatus.done,
      priority: TaskPriority.high,
      dueDate: new Date(Date.now() + 86400000 * 1),
      createdById: user1.id
    }
  });

  const task8 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'Setup React Native Repository',
      description: 'Initialize Expo TypeScript project with navigation.',
      status: TaskStatus.in_progress,
      priority: TaskPriority.medium,
      dueDate: new Date(Date.now() + 86400000 * 6),
      createdById: user2.id
    }
  });

  const task9 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'Implement Push Notifications Service',
      description: 'FCM integration for background notifications.',
      status: TaskStatus.todo,
      priority: TaskPriority.low,
      dueDate: new Date(Date.now() + 86400000 * 10),
      createdById: user3.id
    }
  });

  // Tasks for Project 3 (Stark Industries - Org 2)
  const task10 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'Setup High-Throughput Redis Stream',
      description: 'Buffer sensor telemetry events before batch ingestion.',
      status: TaskStatus.in_progress,
      priority: TaskPriority.urgent,
      dueDate: new Date(Date.now() + 86400000 * 3),
      createdById: user4.id
    }
  });

  const task11 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'Implement Anomaly Detection Pipeline',
      description: 'Detect power spikes and trigger alert webhooks.',
      status: TaskStatus.todo,
      priority: TaskPriority.high,
      dueDate: new Date(Date.now() + 86400000 * 9),
      createdById: user4.id
    }
  });

  const task12 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'Security Audit & Rate Limiting',
      description: 'Apply API key verification and IP rate limiting on ingestion endpoints.',
      status: TaskStatus.review,
      priority: TaskPriority.medium,
      dueDate: new Date(Date.now() + 86400000 * 5),
      createdById: user5.id
    }
  });

  console.log('Created 12 tasks.');

  // 6. Create Task Assignments
  await prisma.taskAssignment.createMany({
    data: [
      { taskId: task1.id, userId: user1.id, assignedById: user1.id },
      { taskId: task2.id, userId: user2.id, assignedById: user1.id },
      { taskId: task3.id, userId: user2.id, assignedById: user1.id },
      { taskId: task3.id, userId: user3.id, assignedById: user1.id },
      { taskId: task4.id, userId: user3.id, assignedById: user1.id },
      { taskId: task7.id, userId: user2.id, assignedById: user1.id },
      { taskId: task10.id, userId: user5.id, assignedById: user4.id },
      { taskId: task12.id, userId: user4.id, assignedById: user4.id }
    ]
  });

  console.log('Created task assignments.');

  // 7. Create Sample Comments
  await prisma.comment.createMany({
    data: [
      {
        taskId: task1.id,
        userId: user1.id,
        content: 'PostgreSQL schema with Prisma models is drafted and verified.'
      },
      {
        taskId: task3.id,
        userId: user2.id,
        content: 'Working on cursor pagination logic with next_cursor tokens.'
      },
      {
        taskId: task4.id,
        userId: user3.id,
        content: 'BullMQ exponential backoff tested with mock email transporter.'
      },
      {
        taskId: task10.id,
        userId: user5.id,
        content: 'Redis cluster configuration ready for benchmarking.'
      }
    ]
  });

  console.log('Created comments.');
  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
