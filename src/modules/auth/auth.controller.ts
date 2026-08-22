import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const meta = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      };
      const result = await authService.register(req.body, meta);
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const meta = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      };
      const result = await authService.login(req.body, meta);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const meta = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      };
      const result = await authService.refresh(req.body.refreshToken, meta);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.logout(req.body.refreshToken);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await authService.logoutAll(userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async googleOAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const meta = { userAgent: req.headers['user-agent'], ipAddress: req.ip };
      const { oauthService } = await import('./oauth.service');
      const result = await oauthService.handleOAuthLogin({ ...req.body, provider: 'google' }, meta);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async githubOAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const meta = { userAgent: req.headers['user-agent'], ipAddress: req.ip };
      const { oauthService } = await import('./oauth.service');
      const result = await oauthService.handleOAuthLogin({ ...req.body, provider: 'github' }, meta);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
