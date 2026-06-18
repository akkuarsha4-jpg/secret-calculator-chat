import express from 'express';
import { body } from 'express-validator';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const contacts = await Contact.find({ ownerId: req.user._id })
    .populate('contactId', 'username userId profilePhoto')
    .sort({ updatedAt: -1 });
  res.json({ contacts: contacts.map(c => c.contactId) });
});

router.post('/', requireAuth, [
  body('userId').matches(/^\d{5}$/),
  validate
], async (req, res) => {
  const contact = await User.findOne({ userId: req.body.userId });
  if (!contact) return res.status(404).json({ message: 'User not found' });
  if (contact._id.equals(req.user._id)) return res.status(400).json({ message: 'You cannot add yourself' });
  await Contact.updateOne(
    { ownerId: req.user._id, contactId: contact._id },
    { $setOnInsert: { ownerId: req.user._id, contactId: contact._id } },
    { upsert: true }
  );
  res.status(201).json({ contact: { id: contact._id, username: contact.username, userId: contact.userId, profilePhoto: contact.profilePhoto } });
});

export default router;
