const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const authRoutes = require('./routes/auth');
const GroupMessage = require('./models/GroupMessage');
const PrivateMessage = require('./models/PrivateMessage');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// put fucking password here OMFG 
mongoose.connect('mongodb+srv://mongodbcomzombie391_db_user:<pass>@assignment1.aenlzmj.mongodb.net/LabTest?appName=Assignment1');
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", () => {
    console.log("Connected to MongoDB");
});

app.use('/api', authRoutes);

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});
app.get('/', (req, res) => {
    res.redirect('/login');
});


// socket.io stuff
io.on('connection', (socket) => {
    console.log('New client connected', socket.id);

    socket.on('join_room', async (data) => {
        const { username, room } = data;
        socket.join(room);
        console.log(`${username} joined room: ${room}`);

        // get history
        try {
            const messages = await GroupMessage.find({ room }).lean();
            //console.log(`Found ${messages.length} messages for room ${room}. Emitting to ${socket.id}`);
            socket.emit('load_history', messages);
        } catch (err) {
            console.error('Error fetching history:', err);
        }

        // say hello to user
        socket.emit('message', {
            user: 'admin',
            text: `${username}, welcome to room ${room}.`,
            from_user: 'admin',
            room: room
        });

        // broadcast to room
        socket.broadcast.to(room).emit('message', {
            user: 'admin',
            text: `${username} has joined the chat`,
            from_user: 'admin',
            room: room
        });
    });

    // listen for chatMessage
    socket.on('chat_message', async (data) => {
        const { from_user, room, message } = data;

        // save to MongoDB
        const newGroupMessage = new GroupMessage({
            from_user,
            room,
            message
        });
        await newGroupMessage.save();

        io.to(room).emit('message', {
            from_user,
            text: message,
            date_sent: newGroupMessage.date_sent
        });
    });

    // typing indicator
    socket.on('typing', (data) => {
        const { username, room } = data;
        socket.broadcast.to(room).emit('typing', {
            username: username
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    // leave room
    socket.on('leave_room', (data) => {
        const { username, room } = data;
        socket.leave(room);
        console.log(`${username} left room: ${room}`);
        socket.broadcast.to(room).emit('message', {
            user: 'admin',
            text: `${username} has left the chat`,
            from_user: 'admin',
            room: room
        });
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
