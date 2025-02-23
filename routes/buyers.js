const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

// Add a new buyer
router.post('/add', (req, res) => {
    const { name, location, contact_number } = req.body;
    if (!name || !location || !contact_number) {
        return res.status(400).send('All fields are required.');
    }

    const query = `INSERT INTO buyers (name, location, contact_number) VALUES (?, ?, ?)`;
    db.run(query, [name, location, contact_number], function (err) {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.redirect('/buyers.html');
    });
});

// Delete a buyer
router.delete('/delete/:id', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).send('Buyer ID is required.');
    }

    const query = `DELETE FROM buyers WHERE id = ?`;
    db.run(query, [id], function (err) {
        if (err) {
            console.error('Error deleting buyer:', err.message);
            return res.status(500).send('Error deleting buyer.');
        }

        res.send(`Buyer with ID ${id} deleted successfully.`);
    });
});

module.exports = router;

// Get all buyers
router.get('/list', (req, res) => {
    const query = `SELECT * FROM buyers`;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.json(rows);
    });
});

module.exports = router;
