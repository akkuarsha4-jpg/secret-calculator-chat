import express from 'express';
import { query } from 'express-validator';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/search', requireAuth, [
  query('userId').matches(/^\d{1,5}$/),
  validate
], async (req, res) => {
  const users = await User.find({
    userId: new RegExp(`^${req.query.userId}`),
    _id: { $ne: req.user._id }
  }).select('username userId profilePhoto').limit(10);
  res.json({ users });
});

router.patch('/profile', requireAuth, async (req, res) => {
  const updates = {};
  if (typeof req.body.username === 'string') updates.username = req.body.username.trim().slice(0, 32);
  if (typeof req.body.profilePhoto === 'string') updates.profilePhoto = req.body.profilePhoto;
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
    .select('-passwordHash -passIdHash -resetCodeHash');
  res.json({ user });
});

export default router;
