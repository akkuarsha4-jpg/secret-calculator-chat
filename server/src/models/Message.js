import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['text', 'image', 'voice', 'file', 'sticker'], default: 'text' },
  content: { type: String, required: true },
  iv: { type: String, default: '' },
  fileName: { type: String, default: '' },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timestamp: { type: Date, default: Date.now }
});

messageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

export default mongoose.model('Message', messageSchema);
