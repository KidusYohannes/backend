import { Response } from 'express';
import { createMahber, getMahbersByUser, getMahberById, updateMahber, deleteMahber } from '../services/mahber.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const addMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) res.status(401).json({ message: 'Unauthorized' });
  try {
    if(req.user !== null && req.user !== undefined) {
        const mahiber = await createMahber({
        ...req.body,
        created_by: req.user.id
        });
        res.status(201).json(mahiber);
    } else {
        res.status(400).json({ message: 'User not authenticated' });
    }
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create mahiber' });
  }
};

export const getMyMahibers = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) { 
        res.status(401).json({ message: 'Unauthorized' }); 
    }else {
        const mahibers = await getMahbersByUser(req.user.id);
        res.json(mahibers);
    }
};

export const getMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahiber = await getMahberById(Number(req.params.id));
  if (!mahiber || mahiber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found' });
    return;
  }
  res.json(mahiber);
};

export const editMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahiber = await getMahberById(Number(req.params.id));
  if (!mahiber || mahiber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found or not authorized' });
    return;
  }
  try {
    const updated = await updateMahber(Number(req.params.id), req.body, req.user.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update mahiber' });
  }
};

export const removeMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahiber = await getMahberById(Number(req.params.id));
  if (!mahiber || mahiber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found or not authorized' });
    return;
  }
  const deleted = await deleteMahber(Number(req.params.id), req.user.id);
  if (!deleted) {
    res.status(404).json({ message: 'Mahiber not found' });
    return;
  }
  res.status(204).send();
};
