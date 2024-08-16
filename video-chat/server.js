// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Notify all other users about the new user
    socket.broadcast.emit('new-user', socket.id);

    // Relay offer to the target user
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', { sdp: data.sdp, sender: socket.id });
    });

    // Relay answer to the offer sender
    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', { sdp: data.sdp, sender: socket.id });
    });

    // Relay ICE candidate to the target user
    socket.on('ice-candidate', (data) => {
        io.to(data.target).emit('ice-candidate', { candidate: data.candidate, sender: socket.id });
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        socket.broadcast.emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
