import { Request, Response, NextFunction } from 'express';
import { jobService } from './job.service';

export class JobController {
  async getJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const job = await jobService.getJobStatus(id);
      return res.status(200).json({ data: job });
    } catch (error) {
      next(error);
    }
  }
}

export const jobController = new JobController();
