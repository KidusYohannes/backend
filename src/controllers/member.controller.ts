import { Response } from 'express';
import * as memberService from '../services/member.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getAllMahbers = async (_req: AuthenticatedRequest, res: Response) => {
  const mahbers = await memberService.getAllMahbers();
  res.json(mahbers);
};

export const requestToJoin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.requestToJoinMahber(req.user!.id.toString(), req.body.edir_id);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const inviteMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.inviteMember(req.user!.id.toString(), req.body.edir_id, req.body.user_id);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const respondToInvite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.respondToInvite(req.user!.id.toString(), req.body.edir_id, req.body.accept);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const respondToJoinRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.respondToJoinRequest(req.user!.id.toString(), req.body.edir_id, req.body.user_id, req.body.accept);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const banMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.banMember(req.user!.id.toString(), req.body.edir_id, req.body.user_id);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const unbanMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.unbanMember(req.user!.id.toString(), req.body.edir_id, req.body.user_id);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};
