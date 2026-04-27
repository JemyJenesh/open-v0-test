import type { Request, Response } from "express";

export function updateProperties(req: Request, res: Response): void {
  const { elementId, properties } = req.body || {};
  res.json({
    success: true,
    properties: {
      elementId,
      ...(properties || {}),
      updatedAt: new Date().toISOString(),
    },
  });
}
