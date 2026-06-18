import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 32 },
  userId: { type: String, required: true, unique: true, match: /^\d{5}$/ },
  passwordHash: { type: String, required: true },
  passIdHash: { type: String, required: true },
  profilePhoto: { type: String, default: '' },
  resetCodeHash: { type: String, default: '' },
  resetCodeExpires: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ username: 'text', userId: 1 });

export default mongoose.model('User', userSchema);
