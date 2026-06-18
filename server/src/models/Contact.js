import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

contactSchema.index({ ownerId: 1, contactId: 1 }, { unique: true });

export default mongoose.model('Contact', contactSchema);
