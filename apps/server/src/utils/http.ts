import { Response } from "express";

export const ok = <T>(res: Response, data: T, message?: string) => {
  return res.status(200).json({ data, message });
};

export const created = <T>(res: Response, data: T, message?: string) => {
  return res.status(201).json({ data, message });
};

export const fail = (res: Response, status: number, message: string) => {
  return res.status(status).json({ error: message });
};
