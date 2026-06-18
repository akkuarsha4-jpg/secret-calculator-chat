import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { body } from 'express-validator';
import User from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
const publicUser = user => ({
  id: user._id,
  username: user.username,
  userId: user.userId,
  profilePhoto: user.profilePhoto,
  createdAt: user.createdAt
});

router.post('/signup', [
  body('username').trim().isLength({ min: 2, max: 32 }).escape(),
  body('userId').matches(/^\d{5}$/),
  body('password').isLength({ min: 8, max: 128 }),
  body('passId').isLength({ min: 4, max: 8 }).isNumeric(),
  validate
], async (req, res) => {
  const exists = await User.findOne({ userId: req.body.userId });
  if (exists) return res.status(409).json({ message: 'User ID is already taken' });
  const user = await User.create({
    username: req.body.username,
    userId: req.body.userId,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    passIdHash: await bcrypt.hash(req.body.passId, 12)
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login/password', [
  body('userId').matches(/^\d{5}$/),
  body('password').isLength({ min: 1, max: 128 }),
  validate
], async (req, res) => {
  const user = await User.findOne({ userId: req.body.userId });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login/passid', [
  body('userId').matches(/^\d{5}$/),
  body('passId').isLength({ min: 4, max: 8 }).isNumeric(),
  validate
], async (req, res) => {
  const user = await User.findOne({ userId: req.body.userId });
  if (!user || !(await bcrypt.compare(req.body.passId, user.passIdHash))) {
    return res.status(401).json({ message: 'Invalid quick login details' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/forgot-password', [
  body('userId').matches(/^\d{5}$/),
  validate
], async (req, res) => {
  const user = await User.findOne({ userId: req.body.userId });
  if (!user) return res.json({ message: 'If the account exists, a reset code was created' });
  const resetCode = crypto.randomInt(100000, 999999).toString();
  user.resetCodeHash = await bcrypt.hash(resetCode, 12);
  user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  res.json({
    message: 'Reset code generated. In production send this by SMS/email.',
    resetCode: process.env.NODE_ENV === 'production' ? undefined : resetCode
  });
});

router.post('/reset-password', [
  body('userId').matches(/^\d{5}$/),
  body('resetCode').isLength({ min: 6, max: 6 }).isNumeric(),
  body('password').isLength({ min: 8, max: 128 }),
  validate
], async (req, res) => {
  const user = await User.findOne({ userId: req.body.userId });
  const valid = user?.resetCodeHash && user.resetCodeExpires > new Date() &&
    await bcrypt.compare(req.body.resetCode, user.resetCodeHash);
  if (!valid) return res.status(400).json({ message: 'Invalid or expired reset code' });
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.resetCodeHash = '';
  user.resetCodeExpires = undefined;
  await user.save();
  res.json({ message: 'Password reset complete' });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
router.post('/logout', requireAuth, (_, res) => res.json({ message: 'Logged out' }));

export default router;
