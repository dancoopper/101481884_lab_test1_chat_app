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
mongoose.connect('mongodb+srv://mongodbcomzombie391_db_user:chJSeCe2WerMJ6Zf1Z@assignment1.aenlzmj.mongodb.net/LabTest?appName=Assignment1');
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
const connectedUsers = {};

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);


    socket.on('login', (username) => {
        connectedUsers[username] = socket.id;
        socket.username = username;
        io.emit('user_list', Object.keys(connectedUsers));
    });

    socket.on('join_room', async (data) => {
        const { username, room } = data;
        socket.join(room);
        console.log(`${username} joined room: ${room}`);

        // get history
        try {
            const messages = await GroupMessage.find({ room }).lean();
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

    // Private Message
    socket.on('private_message', async (data) => {
        const { from_user, to_user, message } = data;

        const newPrivateMessage = new PrivateMessage({
            from_user,
            to_user,
            message
        });
        await newPrivateMessage.save();

        const toSocketId = connectedUsers[to_user];
        if (toSocketId) {
            io.to(toSocketId).emit('private_message', {
                from_user,
                to_user,
                text: message,
                date_sent: newPrivateMessage.date_sent
            });
        }

        socket.emit('private_message', {
            from_user,
            to_user,
            text: message,
            date_sent: newPrivateMessage.date_sent
        });
    });

    socket.on('get_private_history', async (data) => {
        const { user1, user2 } = data;
        try {
            const messages = await PrivateMessage.find({
                $or: [
                    { from_user: user1, to_user: user2 },
                    { from_user: user2, to_user: user1 }
                ]
            }).sort({ date_sent: 1 }).lean();

            socket.emit('load_history', messages);
        } catch (err) {
            console.error(err);
        }
    });

    // typing indicator
    socket.on('typing', (data) => {
        const { username, room } = data;
        if (room) {
            socket.broadcast.to(room).emit('typing', {
                username: username
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            delete connectedUsers[socket.username];
            io.emit('user_list', Object.keys(connectedUsers));
        }
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
