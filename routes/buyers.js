const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

// ✅ **Route to Add a New Buyer with Opening Balance**
router.post('/add', (req, res) => {
    const { name, location, contact_number, opening_balance } = req.body;
    const openingBalanceValue = parseFloat(opening_balance) || 0; // Convert to number, default 0

    const query = `
        INSERT INTO buyers (name, location, contact_number, opening_balance) 
        VALUES (?, ?, ?, ?)
    `;

    db.run(query, [name, location, contact_number, openingBalanceValue], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.redirect('/buyers.html?message=Buyer%20added%20successfully');
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

// ✅ **Fetch All Buyers including Opening Balance**
router.get('/list', (req, res) => {
    const query = `SELECT id, name, location, contact_number, opening_balance FROM buyers`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Error fetching buyers:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});


module.exports = router;
