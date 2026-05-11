const jwt = require('jsonwebtoken');

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_board', (boardId) => {
      socket.join(`board:${boardId}`);
    });

    socket.on('leave_board', (boardId) => {
      socket.leave(`board:${boardId}`);
    });

    // list events
    socket.on('list_created', ({ boardId, list }) => {
      socket.to(`board:${boardId}`).emit('list_created', list);
    });
    socket.on('list_updated', ({ boardId, list }) => {
      socket.to(`board:${boardId}`).emit('list_updated', list);
    });
    socket.on('list_deleted', ({ boardId, listId }) => {
      socket.to(`board:${boardId}`).emit('list_deleted', listId);
    });

    // card events
    socket.on('card_created', ({ boardId, card }) => {
      socket.to(`board:${boardId}`).emit('card_created', card);
    });
    socket.on('card_updated', ({ boardId, card }) => {
      socket.to(`board:${boardId}`).emit('card_updated', card);
    });
    socket.on('card_deleted', ({ boardId, cardId, listId }) => {
      socket.to(`board:${boardId}`).emit('card_deleted', { cardId, listId });
    });
    socket.on('card_moved', ({ boardId, cardId, fromListId, toListId, position }) => {
      socket.to(`board:${boardId}`).emit('card_moved', { cardId, fromListId, toListId, position });
    });
  });
};
