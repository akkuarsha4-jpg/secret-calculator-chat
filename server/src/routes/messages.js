import express from 'express';
import { query } from 'express-validator';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/', requireAuth, [
  query('with').isMongoId(),
  validate
], async (req, res) => {
  const otherId = req.query.with;
  const messages = await Message.find({
    deletedFor: { $ne: req.user._id },
    $or: [
      { senderId: req.user._id, receiverId: otherId },
      { senderId: otherId, receiverId: req.user._id }
    ]
  }).sort({ timestamp: 1 }).limit(200);
  res.json({ messages });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await Message.updateOne(
    { _id: req.params.id, $or: [{ senderId: req.user._id }, { receiverId: req.user._id }] },
    { $addToSet: { deletedFor: req.user._id } }
  );
  res.json({ message: 'Deleted' });
});

export default router;
