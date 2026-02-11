const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { username, firstname, lastname, password } = req.body;

        // Simple validation
        if (!username || !firstname || !lastname || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const newUser = new User({
            username,
            firstname,
            lastname,
            password // Storing as plain text per instructions (prob should be hashed)
        });

        await newUser.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        if (user.password !== password) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        // Return user info (excluding password)
        res.json({
            message: 'Login successful',
            user: {
                username: user.username,
                firstname: user.firstname,
                lastname: user.lastname
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
