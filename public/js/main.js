const socket = io();

const username = localStorage.getItem('username');
if (!username) {
    window.location.href = '/login';
}

$('#current-user').text(username);

let currentRoom = null;
let typingTimeout = null;

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const roomSelect = document.getElementById('room-select');
const joinRoomBtn = document.getElementById('join-room-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const sendBtn = chatForm.querySelector('button');
const currentRoomName = document.getElementById('current-room-name');
const typingIndicator = document.getElementById('typing-indicator');

// Event Listeners

// Logout
$('#logout-btn').click(() => {
    localStorage.clear();
    window.location.href = '/login';
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
    const room = roomSelect.value;
    if (room && room !== currentRoom) {
        if (currentRoom) {
            leaveRoom();
        }
        joinRoom(room);
    }
});

// Leave Room
leaveRoomBtn.addEventListener('click', () => {
    if (currentRoom) {
        leaveRoom();
    }
});

// Send Message
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = msgInput.value;

    if (msg) {
        if (activePrivateUser) {
            socket.emit('private_message', {
                from_user: username,
                to_user: activePrivateUser,
                message: msg
            });
        } else if (currentRoom) {
            // Emit message to server
            socket.emit('chat_message', {
                from_user: username,
                room: currentRoom,
                message: msg
            });
        }

        // Clear input
        msgInput.value = '';
        msgInput.focus();
    }
});

// Typing Indicator
msgInput.addEventListener('input', () => {
    if (currentRoom) {
        socket.emit('typing', { username, room: currentRoom });
    }
});

// Socket Events

socket.on('message', (message) => {
    outputMessage(message);

    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('typing', (data) => {
    if (data.username !== username) {
        typingIndicator.innerText = `${data.username} is typing...`;

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            typingIndicator.innerText = '';
        }, 1000);
    }
});


// Functions

const usersList = document.getElementById('users-list');
let activePrivateUser = null;


socket.emit('login', username);

socket.on('user_list', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        if (user !== username) { // Don't show self
            const btn = document.createElement('button');
            btn.classList.add('btn', 'btn-outline-secondary', 'w-100', 'mb-2', 'text-start');
            btn.innerText = user;
            btn.addEventListener('click', () => startPrivateChat(user));
            usersList.appendChild(btn);
        }
    });
});

socket.on('private_message', (message) => {

    if (activePrivateUser && (message.from_user === activePrivateUser || message.from_user === username)) {
        outputMessage(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {

        if (message.from_user !== username) {
            console.log(`New private message from ${message.from_user}`);
            alert(`New private message from ${message.from_user}`);

        }
    }
});

function startPrivateChat(targetUser) {
    if (currentRoom) {
        leaveRoom();
    }

    activePrivateUser = targetUser;
    currentRoomName.innerText = `Private Chat with ${targetUser}`;

    msgInput.disabled = false;
    sendBtn.disabled = false;
    chatMessages.innerHTML = '';

    socket.emit('get_private_history', { user1: username, user2: targetUser });
}


socket.on('load_history', (messages) => {
    // console.log('Received history event. Message count:', messages ? messages.length : 'null');
    // console.log('Messages data:', messages);

    if (Array.isArray(messages)) {
        messages.forEach(msg => {
            outputMessage({
                from_user: msg.from_user,
                text: msg.message,
                date_sent: msg.date_sent
            });
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});


function joinRoom(room) {
    activePrivateUser = null;
    socket.emit('join_room', { username, room });
    currentRoom = room;

    // Update UI
    currentRoomName.innerText = `Room: ${room}`;
    msgInput.disabled = false;
    sendBtn.disabled = false;
    joinRoomBtn.disabled = true;
    leaveRoomBtn.disabled = false;
    roomSelect.disabled = true;
    chatMessages.innerHTML = '';
}

function leaveRoom() {
    socket.emit('leave_room', { username, room: currentRoom });
    currentRoom = null;

    // Update UI
    currentRoomName.innerText = 'Select a room to start chatting';
    msgInput.disabled = true;
    sendBtn.disabled = true;
    joinRoomBtn.disabled = false;
    leaveRoomBtn.disabled = true;
    roomSelect.disabled = false;
    roomSelect.value = "";
    chatMessages.innerHTML = '';
}

function outputMessage(message) {
    const div = document.createElement('div');
    const isCurrentUser = message.from_user === username;

    div.classList.add('message');
    if (isCurrentUser) {
        div.classList.add('sent');
    } else {
        div.classList.add('received');
    }

    let time;
    if (message.date_sent) {
        time = new Date(message.date_sent).toLocaleTimeString();
    } else {
        time = new Date().toLocaleTimeString();
    }

    div.innerHTML = `
        <div class="message-meta text-end" style="font-size: 0.7em;">${message.from_user} <span>${time}</span></div>
        <p class="mb-0">${message.text}</p>
    `;

    document.getElementById('chat-messages').appendChild(div);
}
