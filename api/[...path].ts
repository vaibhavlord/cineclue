import type { Request, Response } from 'express';
import app from '../src/serverApp.ts';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
