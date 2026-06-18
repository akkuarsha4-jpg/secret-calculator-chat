import jwt from 'jsonwebtoken';
import xss from 'xss';
import User from '../models/User.js';
import Message from '../models/Message.js';

const onlineUsers = new Map();

export function registerSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      const user = await User.findById(payload.sub).select('username userId profilePhoto');
      if (!user) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', socket => {
    const id = socket.user._id.toString();
    onlineUsers.set(id, socket.id);
    socket.join(id);
    io.emit('presence:update', { userId: id, online: true });

    socket.on('message:send', async (payload, ack) => {
      try {
        const message = await Message.create({
          senderId: id,
          receiverId: payload.receiverId,
          type: payload.type || 'text',
          content: payload.type === 'text' || payload.type === 'sticker' ? xss(payload.content) : payload.content,
          iv: payload.iv || '',
          fileName: payload.fileName || ''
        });
        io.to(payload.receiverId).emit('message:new', message);
        socket.emit('message:new', message);
        io.to(payload.receiverId).emit('message:status', { id: message._id, status: 'delivered' });
        await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
    });

    socket.on('message:read', async ({ messageId }) => {
      await Message.findByIdAndUpdate(messageId, { status: 'read' });
      io.emit('message:status', { id: messageId, status: 'read' });
    });

    socket.on('call:offer', data => io.to(data.to).emit('call:offer', { ...data, from: id, caller: socket.user }));
    socket.on('call:answer', data => io.to(data.to).emit('call:answer', { ...data, from: id }));
    socket.on('call:ice', data => io.to(data.to).emit('call:ice', { ...data, from: id }));
    socket.on('call:end', data => io.to(data.to).emit('call:end', { from: id }));

    socket.on('disconnect', () => {
      onlineUsers.delete(id);
      io.emit('presence:update', { userId: id, online: false });
    });
  });
}
