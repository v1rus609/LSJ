const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

// ✅ Add a new container
router.post('/add', (req, res) => {
    const { container_number, weight, arrival_date } = req.body;
    const query = `
        INSERT INTO containers (container_number, weight, arrival_date, remaining_weight) 
        VALUES (?, ?, ?, ?)
    `;
    db.run(query, [container_number, weight, arrival_date, weight], function (err) {
        if (err) {
            return res.status(500).send(err.message);
        }
        // Redirect to container.html with a success message
        res.redirect('/container.html?message=Container%20added%20successfully');
    });
});

// ✅ **Get All Containers with Updated Total Sold**
router.get('/list', (req, res) => {
    const query = `
        SELECT c.id, c.container_number, c.weight, c.arrival_date, c.remaining_weight,
               (c.weight - c.remaining_weight) AS total_sold
        FROM containers c
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching containers:', err.message);
            return res.status(500).json({ error: 'Failed to fetch containers' });
        }
        res.json(rows);
    });
});


// ✅ Sell from multiple containers (with transactions)
router.post('/sell', (req, res) => {
    const {
        container_id,
        buyer_id,
        weight_sold,
        price_per_kg,
        paid_amount,
        purchase_date,
    } = req.body;

    if (!Array.isArray(container_id)) {
        return res.status(400).send('Invalid data format. container_id must be an array.');
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION'); // ✅ Start transaction

        container_id.forEach((id, index) => {
            const weight = parseFloat(weight_sold[index]) || 0;
            const price = parseFloat(price_per_kg[index]) || 0;
            const paid = parseFloat(paid_amount[index]) || 0;
            const total_price = weight * price;
            const unpaid = total_price - paid;

            // ✅ Update container's remaining weight
            db.run(
                `UPDATE containers SET remaining_weight = remaining_weight - ? WHERE id = ?`,
                [weight, id]
            );

            // ✅ Insert the sale record
            db.run(
                `INSERT INTO sales (container_id, buyer_id, weight_sold, price_per_kg, paid_amount, unpaid_amount, total_price, purchase_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, buyer_id, weight, price, paid, unpaid, total_price, purchase_date]
            );
        });

        // ✅ Update buyer's financial data
        const totalPaid = paid_amount.reduce((sum, paid) => sum + parseFloat(paid || 0), 0);
        const totalUnpaid = container_id.reduce((sum, _, index) => {
            const weight = parseFloat(weight_sold[index]) || 0;
            const price = parseFloat(price_per_kg[index]) || 0;
            const total_price = weight * price;
            const paid = parseFloat(paid_amount[index]) || 0;
            return sum + (total_price - paid);
        }, 0);

        db.run(
            `UPDATE buyers SET 
                paid_amount = paid_amount + ?, 
                unpaid_amount = unpaid_amount + ?,
                total_amount = total_amount + ? 
             WHERE id = ?`,
            [totalPaid, totalUnpaid, totalPaid + totalUnpaid, buyer_id],
            (err) => {
                if (err) {
                    db.run('ROLLBACK'); // ✅ Rollback on error
                    return res.status(500).send(err.message);
                }
                db.run('COMMIT'); // ✅ Commit transaction
                res.redirect('/inventory.html?message=Success!%20Product%20Sold');
            }
        );
    });
});

// ✅ Get purchase history
router.get('/purchases', (req, res) => {
    const { buyer, container } = req.query;

    let query = `
        SELECT
            sales.id AS sale_id,
            buyers.name AS buyer_name,
            containers.container_number AS container_number,
            sales.purchase_date,
            sales.paid_amount,
            sales.unpaid_amount,
            sales.total_price
        FROM sales
        JOIN buyers ON sales.buyer_id = buyers.id
        JOIN containers ON sales.container_id = containers.id
        WHERE 1 = 1
    `;

    const params = [];
    if (buyer) {
        query += ` AND sales.buyer_id = ?`;
        params.push(buyer);
    }
    if (container) {
        query += ` AND sales.container_id = ?`;
        params.push(container);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching purchase history:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

router.get('/purchase-return/list', (req, res) => {
    const query = 'SELECT * FROM purchase_returns';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching purchase return data:', err.message);
            return res.status(500).json({ error: 'Failed to fetch purchase return data.' });
        }
        res.json(rows);
    });
});



// ✅ Fetch purchase history with total amounts
router.get('/purchase-history', (req, res) => {
    const buyerId = req.query.buyer_id;

    const query = `
        SELECT sales.id AS sale_id, 
               containers.container_number, 
               sales.unpaid_amount,
               sales.total_price
        FROM sales
        JOIN containers ON sales.container_id = containers.id
        WHERE sales.buyer_id = ? AND sales.unpaid_amount > 0
    `;

    db.all(query, [buyerId], (err, rows) => {
        if (err) {
            console.error('Error fetching purchase history:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// ✅ Handle purchase return
router.post('/purchase-return', (req, res) => {
    const { return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount } = req.body;

    if (!return_date || !buyer_id || !container_id || !returned_kg || !returned_price_per_kg || !total_amount) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // ✅ Insert the purchase return
        db.run(
            `INSERT INTO purchase_returns (return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount]
        );

        // ✅ Update container weight
        db.run(
            `UPDATE containers
             SET remaining_weight = remaining_weight + ?
             WHERE id = ?`,
            [returned_kg, container_id]
        );

        // ✅ Deduct returned amount from sales
        db.run(
            `UPDATE sales
             SET total_price = total_price - ?, 
                 unpaid_amount = unpaid_amount - ? 
             WHERE buyer_id = ?`,
            [total_amount, total_amount, buyer_id],
            (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ success: false, message: 'Failed to update sales statement' });
                }
                db.run('COMMIT');
                res.json({ success: true, message: 'Purchase return recorded successfully' });
            }
        );
    });
});

module.exports = router;
