const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const app = express();
const db = new sqlite3.Database('./database.db');
const port = 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/containers', require('./routes/containers'));

const buyersRoutes = require('./routes/buyers');
app.use('/buyers', buyersRoutes);

app.use('/public', express.static(path.join(__dirname, 'public')));

// Set up session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Dummy users for testing (hashed admin password)
const users = [
    { 
        id: 1, 
        username: 'admin', 
        password: bcrypt.hashSync('admin123', 10),  // Hash the admin password
        role: 'Admin' 
    }, 
    { 
        id: 2, 
        username: 'user', 
        password: bcrypt.hashSync('user123', 10), 
        role: 'User' 
    }
];

// ✅ Middleware to ensure user is logged in
const ensureLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        return next();
    } else {
        return res.redirect('/login.html');
    }
};

// ✅ Middleware to ensure user is an Admin
const ensureAdmin = (req, res, next) => {
    console.log('Session Role:', req.session.role);
    if (req.session.role === 'Admin') {
        return next();
    } else {
        console.log('Access Denied - Not Admin');
        return res.status(403).send('Access denied: You do not have permission to view this page.');
    }
};

// ✅ Middleware to prevent access to login page if already logged in
const preventLoginPage = (req, res, next) => {
    if (req.session.userId) {
        return res.redirect('/index.html');
    }
    next();
};

// ✅ Route to serve login.html with session check
app.get('/login.html', preventLoginPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// ✅ Login handler (POST)
app.post('/login', preventLoginPage, (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.userId = user.id;
        req.session.role = user.role;

        res.json({ success: true, redirectTo: '/index.html' });
    } else {
        res.json({ success: false });
    }
});

// ✅ Admin-only page example
app.get('/admin-page', ensureLoggedIn, (req, res) => {
    if (req.session.role !== 'Admin') {
        return res.status(403).send('Access denied');
    }
    res.send('Welcome to the Admin Page');
});

// ✅ User-only page example
app.get('/user-page', ensureLoggedIn, (req, res) => {
    if (req.session.role !== 'User') {
        return res.status(403).send('Access denied');
    }
    res.send('Welcome to the User Page');
});

// Apply the middleware for restricted routes
app.get('/container.html', ensureLoggedIn, ensureAdmin, (req, res) => {
    res.sendFile(__dirname + '/container.html'); // Only accessible by Admins
});

app.get('/inventory.html', ensureLoggedIn, ensureAdmin, (req, res) => {
    res.sendFile(__dirname + '/inventory.html');
});

app.get('/buyers.html', ensureLoggedIn, ensureAdmin, (req, res) => {
    res.sendFile(__dirname + '/buyers.html');
});

// Add more Admin-only routes as needed
app.get('/index.html', ensureLoggedIn, (req, res) => {
    res.sendFile(__dirname + '/index.html'); // Home page, accessible only after login
});

// Endpoint to check if the user is logged in and their role
app.get('/check-role', (req, res) => {
    if (req.session.userId) {
        return res.json({ loggedIn: true, role: req.session.role });
    } else {
        return res.json({ loggedIn: false });
    }
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.get('/download-db', ensureLoggedIn, (req, res) => {
    const filePath = path.join(__dirname, 'database.db');
    res.download(filePath, 'database.db', (err) => {
        if (err) {
            console.error('Error downloading database:', err);
            res.status(500).send('Error downloading the file.');
        }
    });
});



// Fetch Buyer List
app.get('/buyers/list', (req, res) => {
    const query = `
        SELECT 
            id, 
            name, 
            location, 
            contact_number, 
            paid_amount, 
            unpaid_amount, 
            total_amount
        FROM buyers
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching buyers:', err.message);
            return res.status(500).send('Error fetching buyers.');
        }
        res.json(rows);
    });
});

// Fetch Payment History
app.get('/payments/history', (req, res) => {
    const { buyer_name, start_date, end_date } = req.query;

    let query = `
        SELECT id, buyer_name, payment_date, particulars, bank_amount, cash_amount, payment_method,
               (IFNULL(bank_amount, 0) + IFNULL(cash_amount, 0)) AS total
        FROM payment_history
        WHERE 1=1
    `;
    const params = [];

    if (buyer_name && buyer_name !== 'all') {
        query += ` AND buyer_name = ?`;
        params.push(buyer_name);
    }
    if (start_date) {
        query += ` AND payment_date >= ?`;
        params.push(start_date);
    }
    if (end_date) {
        query += ` AND payment_date <= ?`;
        params.push(end_date);
    }

    query += ` ORDER BY payment_date DESC`;

db.all(query, params, (err, rows) => {
    if (err) {
        console.error('Error fetching payment history:', err.message);
        return res.status(500).send('Error fetching payment history.');
    }

    console.log('Payment history fetched:', rows); // Debug log
    const totalReceived = rows.reduce((sum, row) => sum + row.total, 0);

    res.json({ payments: rows, totalReceived });
});

});




// Fetch Purchase History
app.get('/purchases', (req, res) => {
    const { buyer, container, start_date, end_date } = req.query;

    let query = `
        SELECT
            sales.id AS sale_id,
            sales.bill_no,  -- ✅ Fetch Bill No.
            buyers.name AS buyer_name,  -- Join buyers table to get the buyer name
            containers.container_number AS container_number,
            sales.purchase_date,
            sales.weight_sold,
            sales.price_per_kg,
            sales.paid_amount,
            sales.unpaid_amount,
            sales.total_price
        FROM sales
        JOIN buyers ON sales.buyer_id = buyers.id  -- Join the buyers table on buyer_id
        JOIN containers ON sales.container_id = containers.id
        WHERE 1 = 1
    `;

    const params = [];
    
    // Add filter for buyer
    if (buyer) {
        query += ` AND sales.buyer_id = ?`;
        params.push(buyer);
    }

    // Add filter for container
    if (container) {
        query += ` AND sales.container_id = ?`;
        params.push(container);
    }

    // Add filter for start_date
    if (start_date) {
        query += ` AND sales.purchase_date >= ?`;
        params.push(start_date);  // The date should be in 'YYYY-MM-DD' format
    }

    // Add filter for end_date
    if (end_date) {
        query += ` AND sales.purchase_date <= ?`;
        params.push(end_date);  // The date should be in 'YYYY-MM-DD' format
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching purchase history:', err.message);
            return res.status(500).send('Error fetching purchase history.');
        }
        res.json(rows);
    });
});


// Dashboard Metrics with Opening Balance in Net Sales Calculation
app.get('/dashboard-metrics', (req, res) => {
    const queryTotalSell = `SELECT IFNULL(SUM(total_price), 0) AS total_sell FROM sales`;
    const queryTotalPurchaseReturns = `SELECT IFNULL(SUM(total_amount), 0) AS total_purchase_returns FROM purchase_returns`;
    const queryTotalPaid = `
        SELECT 
            IFNULL(SUM(sales.paid_amount), 0) + 
            IFNULL((SELECT SUM(cash_amount + bank_amount) FROM payment_history), 0) AS total_paid
        FROM sales`;
    const queryTotalBuyers = `SELECT COUNT(*) AS total_buyers FROM buyers`;
    const queryTotalContainers = `SELECT COUNT(*) AS total_containers FROM containers`;
    const queryRemainingWeight = `SELECT IFNULL(SUM(remaining_weight), 0) AS total_remaining_weight FROM containers`;  // Query for remaining weight
    const queryOpeningBalance = `SELECT IFNULL(SUM(opening_balance), 0) AS total_opening_balance FROM buyers`; // Query for opening balance

    db.serialize(() => {
        let metrics = {
            total_sell: 0,
            total_purchase_returns: 0,
            total_paid: 0,
            total_unpaid: 0,
            total_buyers: 0,
            total_containers: 0,
            total_remaining_weight: 0,
            total_opening_balance: 0 // New field for opening balance
        };

        console.log("🔍 Fetching dashboard metrics...");

        db.get(queryTotalSell, (err, row) => {
            if (err) return res.status(500).send('Error fetching total sales.');
            metrics.total_sell = row.total_sell || 0;
            console.log(`🟢 Total Sales: ${metrics.total_sell}`);
        });

        db.get(queryTotalPurchaseReturns, (err, row) => {
            if (err) return res.status(500).send('Error fetching total purchase returns.');
            metrics.total_purchase_returns = row.total_purchase_returns || 0;
            console.log(`🟠 Total Purchase Returns: ${metrics.total_purchase_returns}`);
        });

        db.get(queryTotalPaid, (err, row) => {
            if (err) return res.status(500).send('Error fetching total paid.');
            metrics.total_paid = row.total_paid || 0;
            console.log(`🔵 Total Paid: ${metrics.total_paid}`);
        });

        db.get(queryTotalBuyers, (err, row) => {
            if (err) return res.status(500).send('Error fetching total buyers.');
            metrics.total_buyers = row.total_buyers || 0;
            console.log(`👥 Total Buyers: ${metrics.total_buyers}`);
        });

        db.get(queryTotalContainers, (err, row) => {
            if (err) return res.status(500).send('Error fetching total containers.');
            metrics.total_containers = row.total_containers || 0;
            console.log(`📦 Total Containers: ${metrics.total_containers}`);
        });

        db.get(queryRemainingWeight, (err, row) => { // Fetch remaining weight
            if (err) return res.status(500).send('Error fetching total remaining weight.');
            metrics.total_remaining_weight = row.total_remaining_weight || 0; // Add the remaining weight to the metrics
            console.log(`📦 Total Remaining Weight: ${metrics.total_remaining_weight}`);
        });

        db.get(queryOpeningBalance, (err, row) => { // Fetch opening balance for all buyers
            if (err) return res.status(500).send('Error fetching opening balance.');
            metrics.total_opening_balance = row.total_opening_balance || 0;
            console.log(`📊 Total Opening Balance: ${metrics.total_opening_balance}`);
        });

        // ✅ Ensure calculations happen after all queries complete
        setTimeout(() => {
            // ✅ Calculate Net Sales (Including Opening Balance)
            metrics.net_sale = metrics.total_sell + metrics.total_opening_balance - metrics.total_purchase_returns;
            console.log(`💰 Net Sales Calculated (Including Opening Balance): ${metrics.net_sale}`);

            // ✅ Calculate Total Unpaid Correctly
            metrics.total_unpaid = metrics.net_sale - metrics.total_paid;
            if (isNaN(metrics.total_unpaid)) metrics.total_unpaid = 0; // Prevent NaN

            console.log(`📊 Final Metrics:\n`, metrics);

            res.json(metrics);
        }, 500);
    });
});

// Handle received payment
app.post('/payments/receive', (req, res) => {
    const { sale_id, payment_amount } = req.body;

    if (!sale_id || !payment_amount) {
        return res.status(400).json({ error: 'Sale ID and payment amount are required.' });
    }

    const updateSaleQuery = `
        UPDATE sales
        SET 
            paid_amount = paid_amount + ?, 
            unpaid_amount = unpaid_amount - ?
        WHERE id = ? AND unpaid_amount >= ?
    `;

    db.run(updateSaleQuery, [payment_amount, payment_amount, sale_id, payment_amount], function (err) {
        if (err) {
            console.error('Error updating payment:', err.message);
            return res.status(500).json({ error: 'Failed to process payment.' });
        }

        res.send('Payment processed successfully.');
    });
});


// Handle received payment with unpaid balance validation
app.post('/payments/distribute', (req, res) => {
    const { buyer_id, payment_date, payment_method, payment_amount, particulars } = req.body;

    if (!buyer_id || !payment_date || !payment_method || !payment_amount || payment_amount <= 0) {
        return res.status(400).json({ error: 'All fields are required and payment amount must be greater than zero.' });
    }

    // Fetch buyer name and unpaid balance
    const queryUnpaidBalance = `
        SELECT 
            (IFNULL(SUM(sales.unpaid_amount), 0) - 
            IFNULL((SELECT SUM(cash_amount + bank_amount) FROM payment_history WHERE buyer_id = ?), 0)) 
            AS total_unpaid 
        FROM sales 
        WHERE buyer_id = ?`;

    db.get(queryUnpaidBalance, [buyer_id, buyer_id], (err, result) => {
        if (err) {
            console.error('Error fetching total unpaid balance:', err.message);
            return res.status(500).json({ error: 'Error fetching unpaid balance.' });
        }

        const totalUnpaid = result?.total_unpaid || 0;
        if (payment_amount > totalUnpaid) {
            return res.status(400).json({ error: `Payment exceeds the total unpaid amount of ${totalUnpaid}.` });
        }

        const buyerNameQuery = `SELECT name FROM buyers WHERE id = ?`;
        db.get(buyerNameQuery, [buyer_id], (err, buyer) => {
            if (err || !buyer) {
                console.error('Error fetching buyer name:', err?.message || 'Buyer not found.');
                return res.status(500).json({ error: 'Error fetching buyer name.' });
            }

            const buyerName = buyer.name;

            db.all(
                `SELECT id, unpaid_amount FROM sales WHERE buyer_id = ? AND unpaid_amount > 0 ORDER BY id ASC`,
                [buyer_id],
                (err, rows) => {
                    if (err) {
                        console.error('Error fetching unpaid sales:', err.message);
                        return res.status(500).json({ error: 'Error fetching unpaid sales.' });
                    }

                    let remainingAmount = payment_amount;
                    const updates = [];

                    for (const sale of rows) {
                        if (remainingAmount <= 0) break;

                        const amountToDeduct = Math.min(remainingAmount, sale.unpaid_amount);
                        remainingAmount -= amountToDeduct;

                        updates.push({
                            sale_id: sale.id,
                            amountToDeduct,
                        });
                    }

                    const applyUpdates = () => {
                        if (updates.length === 0) {
                            const bankAmount = payment_method === 'bank' ? payment_amount : 0;
                            const cashAmount = payment_method === 'cash' ? payment_amount : 0;

                            db.run(
                                `INSERT INTO payment_history (payment_date, particulars, bank_amount, cash_amount, buyer_name, buyer_id)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                                [payment_date, particulars, bankAmount, cashAmount, buyerName, buyer_id],
                                (insertErr) => {
                                    if (insertErr) {
                                        console.error('Error inserting payment history:', insertErr.message);
                                        return res.status(500).json({ error: 'Error saving payment history.' });
                                    }
                                    return res.json({ success: true });
                                }
                            );
                        } else {
                            const update = updates.shift();
                            db.run(
                                `UPDATE sales
                                 SET paid_amount = paid_amount + ?, unpaid_amount = unpaid_amount - ?
                                 WHERE id = ?`,
                                [update.amountToDeduct, update.amountToDeduct, update.sale_id],
                                (updateErr) => {
                                    if (updateErr) {
                                        console.error('Error updating sale:', updateErr.message);
                                        return res.status(500).json({ error: 'Error processing payment.' });
                                    }
                                    applyUpdates();
                                }
                            );
                        }
                    };

                    applyUpdates();
                }
            );
        });
    });
});


app.get('/buyers/unpaid-amount/:buyer_id', (req, res) => {
    const buyerId = req.params.buyer_id;

    const queryTotalUnpaid = `
        SELECT IFNULL(SUM(unpaid_amount), 0) AS total_unpaid 
        FROM sales 
        WHERE buyer_id = ?`;

    const queryTotalPaid = `
        SELECT IFNULL(SUM(cash_amount + bank_amount), 0) AS total_paid 
        FROM payment_history 
        WHERE buyer_id = ?`;

    const queryTotalReturns = `
        SELECT IFNULL(SUM(total_amount), 0) AS total_returns 
        FROM purchase_returns 
        WHERE buyer_id = ?`;

    db.serialize(() => {
        db.get(queryTotalUnpaid, [buyerId], (err, unpaidRow) => {
            if (err) {
                console.error('❌ Error fetching unpaid amount:', err.message);
                return res.status(500).json({ error: 'Error fetching unpaid amount' });
            }
            console.log(`📊 Buyer ${buyerId} | Total Unpaid from Sales:`, unpaidRow.total_unpaid);

            db.get(queryTotalPaid, [buyerId], (err, paidRow) => {
                if (err) {
                    console.error('❌ Error fetching total paid:', err.message);
                    return res.status(500).json({ error: 'Error fetching total paid' });
                }
                console.log(`💰 Buyer ${buyerId} | Total Paid from Payment History:`, paidRow.total_paid);

                db.get(queryTotalReturns, [buyerId], (err, returnRow) => {
                    if (err) {
                        console.error('❌ Error fetching total returns:', err.message);
                        return res.status(500).json({ error: 'Error fetching total returns' });
                    }
                    console.log(`🔄 Buyer ${buyerId} | Total Purchase Returns:`, returnRow.total_returns);

                    // ✅ Final Unpaid Calculation
                    const totalUnpaid = unpaidRow.total_unpaid || 0;
                    const totalPaid = paidRow.total_paid || 0;
                    const totalReturns = returnRow.total_returns || 0;

                    console.log(`📢 Calculating Final Unpaid Amount: ${totalUnpaid} - ${totalPaid} - ${totalReturns}`);

                    const adjustedUnpaid = totalUnpaid - totalPaid - totalReturns;
                    const finalUnpaid = Math.max(0, adjustedUnpaid); // Prevent negative unpaid amounts

                    console.log(`✅ Final Adjusted Unpaid Amount for Buyer ${buyerId}:`, finalUnpaid);

                    res.json({ unpaid_amount: finalUnpaid });
                });
            });
        });
    });
});




// Add a new payment record
app.post('/payments/history/add', (req, res) => {
    const { payment_date, particulars, bank_amount, cash_amount, payment_method, buyer_id, buyer_name } = req.body;

    // Validate inputs
    if (!payment_date || !buyer_id || (bank_amount == null && cash_amount == null)) {
        return res.status(400).json({ error: 'Payment date, buyer ID, and at least one payment amount are required.' });
    }

    const query = `
        INSERT INTO payment_history (payment_date, particulars, bank_amount, cash_amount, payment_method, buyer_id, buyer_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [payment_date, particulars, bank_amount || 0, cash_amount || 0, payment_method, buyer_id, buyer_name], function (err) {
        if (err) {
            console.error('Error adding payment history:', err.message);
            return res.status(500).json({ error: 'Error saving payment history.' });
        }

        res.json({ success: true });
    });
});



// Fetch payment history
app.get('/payments/history', (req, res) => {
    const { buyer_name, start_date, end_date } = req.query;

    let query = `
        SELECT id, payment_date, particulars, bank_amount, cash_amount, buyer_name, payment_method ,
               (IFNULL(bank_amount, 0) + IFNULL(cash_amount, 0)) AS total
        FROM payment_history
        WHERE 1=1
    `;
    const params = [];

    if (buyer_name && buyer_name !== 'all') {
        query += ` AND buyer_name = ?`;
        params.push(buyer_name);
    }
    if (start_date) {
        query += ` AND payment_date >= ?`;
        params.push(start_date);
    }
    if (end_date) {
        query += ` AND payment_date <= ?`;
        params.push(end_date);
    }

    query += ` ORDER BY payment_date DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching payment history:', err.message);
            return res.status(500).send('Error fetching payment history.');
        }

        // Calculate total received
        const totalReceived = rows.reduce((sum, row) => sum + row.total, 0);

        res.json({ payments: rows, totalReceived });
    });
});


app.get('/sales/statement', (req, res) => {
    const { buyer_name, start_date, end_date } = req.query;

    let querySales = `
        SELECT 
            buyers.id AS buyer_id,
            buyers.name AS buyer_name,
            IFNULL(SUM(sales.total_price), 0) AS total_purchase,
            IFNULL(SUM(sales.unpaid_amount), 0) AS total_unpaid,
            IFNULL(SUM(sales.paid_amount), 0) AS paid_at_sale
        FROM buyers
        LEFT JOIN sales ON buyers.id = sales.buyer_id
        WHERE 1=1
    `;

    let queryPayments = `
        SELECT buyer_id, IFNULL(SUM(cash_amount + bank_amount), 0) AS total_payment
        FROM payment_history
        GROUP BY buyer_id
    `;

    const params = [];

    if (buyer_name && buyer_name !== 'all') {
        querySales += ` AND buyers.name = ?`;
        params.push(buyer_name);
    }
    if (start_date) {
        querySales += ` AND sales.purchase_date >= ?`;
        params.push(start_date);
    }
    if (end_date) {
        querySales += ` AND sales.purchase_date <= ?`;
        params.push(end_date);
    }

    querySales += ` GROUP BY buyers.id ORDER BY buyers.name ASC`;

    db.all(querySales, params, (err, salesRows) => {
        if (err) {
            console.error('Error fetching sales statement:', err.message);
            return res.status(500).send('Error fetching sales statement.');
        }

        db.all(queryPayments, [], (err, paymentRows) => {
            if (err) {
                console.error('Error fetching payment history:', err.message);
                return res.status(500).send('Error fetching payment history.');
            }

            // ✅ Create a map of payments per buyer
            const paymentsMap = {};
            paymentRows.forEach(row => {
                paymentsMap[row.buyer_id] = row.total_payment || 0;
            });

            // ✅ Merge payments into sales data
            const finalData = salesRows.map(sale => ({
                ...sale,
                total_paid: (paymentsMap[sale.buyer_id] || 0) + sale.paid_at_sale, // ✅ Sum both sources
                total_unpaid: sale.total_unpaid - (paymentsMap[sale.buyer_id] || 0) - sale.paid_at_sale // ✅ Adjust balance correctly
            }));

            res.json(finalData);
        });
    });
});


// Fetch Containers based on Sales
app.get('/get-containers-by-buyer', (req, res) => {
    const buyerId = req.query.id;  // Get buyerId from query string

    if (!buyerId || buyerId === "0" || buyerId === "null") {
        return res.status(400).json({ error: 'Invalid buyer ID.' });
    }

    // Query to fetch containers based on sales (since purchases must be made for a return to happen)
    const query = `
        SELECT containers.id, containers.container_number
        FROM containers
        JOIN sales ON containers.id = sales.container_id
        WHERE sales.buyer_id = ?`;
    
    db.all(query, [buyerId], (err, results) => {
        if (err) {
            console.error('Error fetching containers from sales:', err.message);
            return res.status(500).json({ error: 'Failed to fetch containers.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'No containers found for this buyer.' });
        }

        res.json(results);  // Return the list of containers as a JSON response
    });
});

// Fetch Purchase Returns (Return History) with filters
// Backend: Purchase Returns with Date Filtering
app.get('/purchase-returns', (req, res) => {
    const { buyer, container, start_date, end_date } = req.query;

    let query = `
        SELECT pr.*, b.name AS buyer_name, c.container_number
        FROM purchase_returns pr
        JOIN buyers b ON pr.buyer_id = b.id
        JOIN containers c ON pr.container_id = c.id
        WHERE 1=1
    `;

    const queryParams = [];

    if (buyer) {
        query += ` AND pr.buyer_id = ?`;
        queryParams.push(buyer);
    }

    if (container) {
        query += ` AND pr.container_id = ?`;
        queryParams.push(container);
    }

    if (start_date) {
        query += ` AND pr.return_date >= ?`;
        queryParams.push(start_date);
    }

    if (end_date) {
        query += ` AND pr.return_date <= ?`;
        queryParams.push(end_date);
    }

    db.all(query, queryParams, (err, rows) => {
        if (err) {
            console.error('Error fetching purchase returns:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(rows);
    });
});


// Fetch all containers when no buyer is selected
app.get('/get-all-containers', (req, res) => {
    const query = 'SELECT * FROM containers'; // Query to fetch all containers from the database
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching all containers:', err.message);
            return res.status(500).json({ success: false, message: 'Error fetching containers' });
        }
        res.json(rows); // Send all containers as the response
    });
});


// ✅ **Handle Purchase Return: Only Update Containers Table**
app.post('/purchase-return', (req, res) => {
    const { return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount } = req.body;

    if (!return_date || !buyer_id || !container_id || !returned_kg || !returned_price_per_kg || !total_amount) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    db.serialize(() => {
        // **Step 1: Insert the return record**
        db.run(
            `INSERT INTO purchase_returns (return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount],
            function (err) {
                if (err) {
                    console.error('Error inserting purchase return:', err.message);
                    return res.status(500).json({ success: false, message: 'Failed to submit purchase return' });
                }

                // **Step 2: Update the containers table**
                db.run(
                    `UPDATE containers
                     SET remaining_weight = remaining_weight + ?, 
                         weight = weight
                     WHERE id = ?`,
                    [returned_kg, container_id],
                    function (err) {
                        if (err) {
                            console.error('Error updating container weight:', err.message);
                            return res.status(500).json({ success: false, message: 'Failed to update container weight' });
                        }

                        return res.json({ success: true, message: 'Purchase return recorded successfully' });
                    }
                );
            }
        );
    });
});

app.post('/sales/statement/update/:buyerId', (req, res) => {
    const { returnedAmount } = req.body;
    const { buyerId } = req.params;

    if (!buyerId || !returnedAmount) {
        return res.status(400).json({ success: false, message: 'Invalid buyer ID or returned amount' });
    }

    db.run(
        `UPDATE sales
         SET total_price = total_price - ?, 
             unpaid_amount = unpaid_amount - ?
         WHERE id IN (
             SELECT id FROM sales 
             WHERE buyer_id = ? 
             ORDER BY purchase_date DESC 
             LIMIT 1
         )`,
        [returnedAmount, returnedAmount, buyerId],
        function (err) {
            if (err) {
                console.error('Error updating sales statement:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to update sales statement' });
            }
            res.json({ success: true, message: 'Sales statement updated successfully' });
        }
    );
});


// ✅ **API: Fetch Updated Containers List with Correct Remaining Weight Calculation**
app.get('/containers/list', (req, res) => {
    const query = `
        SELECT 
            c.id AS container_id,
            c.container_number,
            c.weight AS initial_weight,
            c.arrival_date,
            IFNULL(s.total_weight_sold, 0) AS total_weight_sold,
            IFNULL(pr.total_weight_returned, 0) AS total_weight_returned,
            (c.weight - IFNULL(s.total_weight_sold, 0) + IFNULL(pr.total_weight_returned, 0)) AS remaining_weight
        FROM containers c
        LEFT JOIN 
            (SELECT container_id, SUM(weight_sold) AS total_weight_sold FROM sales GROUP BY container_id) s
            ON c.id = s.container_id
        LEFT JOIN 
            (SELECT container_id, SUM(returned_kg) AS total_weight_returned FROM purchase_returns GROUP BY container_id) pr
            ON c.id = pr.container_id;
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Error fetching containers:', err.message);
            return res.status(500).json({ error: 'Failed to fetch containers' });
        }

        res.json(rows);  // ✅ Return correct remaining weight
    });
});

// ✅ API to fetch all purchase returns (needed for frontend calculations)
app.get('/purchase-return/list', (req, res) => {
    const query = `SELECT * FROM purchase_returns`; // Ensure table name is correct

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching purchase returns:', err.message);
            return res.status(500).json({ error: 'Failed to fetch purchase return data.' });
        }
        res.json(rows);
    });
});

// Route to fetch opening balance for a specific buyer
app.get('/buyers/opening-balance/:buyerId', (req, res) => {
    const buyerId = req.params.buyerId;

    const query = 'SELECT opening_balance FROM buyers WHERE id = ?';

    db.get(query, [buyerId], (err, row) => {
        if (err) {
            console.error('Error fetching opening balance:', err.message);
            return res.status(500).json({ error: 'Error fetching opening balance' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Buyer not found' });
        }

        res.json({ opening_balance: row.opening_balance });
    });
});


app.get('/buyer-timeline', (req, res) => {
    const buyerId = req.query.buyer_id;
    if (!buyerId) {
        return res.status(400).json({ error: "Buyer ID is required" });
    }

    const queryPurchases = `
        SELECT purchase_date AS date, 'Purchase' AS type, 
               'Purchase: ' || containers.container_number AS particulars,
               containers.container_number AS details,
               weight_sold AS quantity, 
               price_per_kg AS rate, 
               paid_amount AS cash, 
               NULL AS bank, 
               NULL AS non_cash, 
               total_price AS bill_amount,
               sales.bill_no AS bill_no  -- Add bill_no from the sales table
        FROM sales
        JOIN containers ON sales.container_id = containers.id
        WHERE buyer_id = ?`;

    const queryPayments = `
        SELECT payment_date AS date, 'Payment' AS type, 
               'Payment: ' || payment_method AS particulars,
               payment_method AS details,
               NULL AS quantity, NULL AS rate, 
               cash_amount AS cash, 
               bank_amount AS bank, 
               NULL AS non_cash, 
               NULL AS bill_amount
        FROM payment_history 
        WHERE buyer_id = ?`;

    const queryReturns = `
        SELECT return_date AS date, 'Return' AS type, 
               'Return: ' || containers.container_number AS particulars,
               containers.container_number AS details,
               returned_kg AS quantity, 
               returned_price_per_kg AS rate, 
               NULL AS cash, 
               NULL AS bank, 
               total_amount AS non_cash, 
               NULL AS bill_amount
        FROM purchase_returns
        JOIN containers ON purchase_returns.container_id = containers.id
        WHERE buyer_id = ?`;

    db.all(queryPurchases, [buyerId], (err, purchases) => {
        if (err) {
            console.error("Error fetching purchases:", err.message);
            return res.status(500).json({ error: "Error fetching purchases" });
        }

        db.all(queryPayments, [buyerId], (err, payments) => {
            if (err) {
                console.error("Error fetching payments:", err.message);
                return res.status(500).json({ error: "Error fetching payments" });
            }

            db.all(queryReturns, [buyerId], (err, returns) => {
                if (err) {
                    console.error("Error fetching returns:", err.message);
                    return res.status(500).json({ error: "Error fetching returns" });
                }

                let timeline = [...purchases, ...payments, ...returns].sort((a, b) => new Date(a.date) - new Date(b.date));

                // 🔹 Calculate running balance
                let runningTotal = 0;
				                // First, handle the opening balance
                const openingBalance = 0; // Get the opening balance from database or assume 0
                if (openingBalance > 0) {
                    // Add opening balance row only if it's greater than 0
                    const openingBalanceRow = {
                        date: '-',
                        type: 'Opening Balance',
                        particulars: '-',
                        details: '-',
                        quantity: '-',
                        rate: '-',
                        cash: '-',
                        bank: '-',
                        non_cash: '-',
                        bill_amount: openingBalance,
                        total_taka: openingBalance,
                        bill_no: '-'
                    };
                    timeline.unshift(openingBalanceRow);
                    runningTotal += openingBalance; // Start the running total with the opening balance
                }

                timeline.forEach(entry => {
                    if (entry.bill_amount) {
                        runningTotal += entry.bill_amount; // Purchases increase total
                    }
                    if (entry.cash) {
                        runningTotal -= entry.cash; // Payments decrease total
                    }
                    if (entry.bank) {
                        runningTotal -= entry.bank; // Payments decrease total
                    }
                    if (entry.non_cash) {
                        runningTotal -= entry.non_cash; // Returns decrease total
                    }
                    entry.total_taka = runningTotal; // Store the updated running total
                });

                res.json({ timeline });
            });
        });
    });
});


// ✅ Get Containers a Buyer Purchased From
app.get('/buyer-containers/:buyerId', (req, res) => {
    const { buyerId } = req.params;

    const query = `
        SELECT DISTINCT s.container_id, c.container_number
        FROM sales s
        JOIN containers c ON s.container_id = c.id
        WHERE s.buyer_id = ?
    `;

    db.all(query, [buyerId], (err, rows) => {
        if (err) {
            console.error('❌ Error fetching buyer containers:', err);
            return res.status(500).json({ error: 'Error fetching containers' });
        }
        res.json(rows);
    });
});


// ✅ Get Purchase Details for Selected Container
app.get('/container-purchase-details/:buyerId/:containerId', (req, res) => {
    const { buyerId, containerId } = req.params;

    const queryTotalPurchased = `
        SELECT IFNULL(SUM(weight_sold), 0) AS total_purchased, price_per_kg
        FROM sales
        WHERE buyer_id = ? AND container_id = ?
    `;

    const queryTotalReturned = `
        SELECT IFNULL(SUM(returned_kg), 0) AS total_returned
        FROM purchase_returns
        WHERE buyer_id = ? AND container_id = ?
    `;

    let responseData = {};

    db.get(queryTotalPurchased, [buyerId, containerId], (err, row) => {
        if (err) {
            console.error('❌ Error fetching total purchased:', err);
            return res.status(500).json({ error: 'Error fetching purchase data' });
        }
        responseData.total_purchased = row.total_purchased;
        responseData.price_per_kg = row.price_per_kg;

        db.get(queryTotalReturned, [buyerId, containerId], (err, row) => {
            if (err) {
                console.error('❌ Error fetching total returned:', err);
                return res.status(500).json({ error: 'Error fetching return data' });
            }
            responseData.total_returned = row.total_returned;
            res.json(responseData);
        });
    });
});


// Route to fetch buyer location by ID
app.get('/buyers/location/:id', (req, res) => {
    const buyerId = req.params.id;

    const query = "SELECT location FROM buyers WHERE id = ?";
    db.get(query, [buyerId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching buyer location.' });
        }

        if (row) {
            res.json({ location: row.location });
        } else {
            res.status(404).json({ error: 'Buyer not found.' });
        }
    });
});

// Fetch a purchase record for editing
app.get('/purchase-record/:id', (req, res) => {
    const id = req.params.id;

    const query = `
        SELECT 
			sales.buyer_id,
            sales.id AS sale_id,
            buyers.name AS buyer_name,
            sales.purchase_date,
            sales.weight_sold,
            sales.price_per_kg,
            sales.paid_amount,
            sales.unpaid_amount,
            sales.total_price,
            sales.bill_no  -- Include the bill_no field here
        FROM sales
        JOIN buyers ON sales.buyer_id = buyers.id
        WHERE sales.id = ?
    `;

    db.get(query, [id], (err, row) => {
        if (err) {
            console.error('Error fetching purchase record:', err);
            return res.status(500).json({ error: err.message });
        }

        if (!row) {
            return res.status(404).json({ error: 'Record not found' });
        }

        res.json(row);  // Return the purchase record, including the bill_no
    });
});



app.put('/purchase-record/update', (req, res) => {
    console.log('Request body:', req.body);  // Log the incoming request body

    const { purchase_date, buyer_id, weight_sold, price_per_kg, paid_amount, unpaid_amount, total_price, bill_no, id } = req.body;

    // Validation
    if (!buyer_id) {
        console.error('Buyer ID is missing');
        return res.status(400).json({ success: false, error: 'Buyer ID is required' });
    }
    if (!purchase_date || !weight_sold || !price_per_kg || !paid_amount || !unpaid_amount || !total_price || !bill_no || !id) {
        console.error('Missing required fields');
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Ensure that buyer exists in the database
    db.get('SELECT id FROM buyers WHERE id = ?', [buyer_id], (err, buyer) => {
        if (err) {
            console.error('Error finding buyer:', err);
            return res.status(500).json({ success: false, error: 'Error finding buyer' });
        }

        if (!buyer) {
            return res.status(404).json({ success: false, error: 'Buyer not found' });
        }

        // Now update the record in the sales table
        const query = `
            UPDATE sales 
            SET purchase_date = ?, buyer_id = ?, weight_sold = ?, price_per_kg = ?, paid_amount = ?, unpaid_amount = ?, total_price = ?, bill_no = ?
            WHERE id = ?
        `;

        const params = [purchase_date, buyer_id, weight_sold, price_per_kg, paid_amount, unpaid_amount, total_price, bill_no, id];

        // Log the query and parameters for debugging
        console.log('Running query:', query);
        console.log('With params:', params);

        db.run(query, params, function (err) {
            if (err) {
                console.error('Error updating purchase record:', err);
                return res.status(500).json({ success: false, error: 'Failed to update record' });
            }

            // Log the result of the update
            console.log(`Updated purchase record with ID: ${id}`);
            res.json({ success: true });
        });
    });
});



// Delete a purchase record
app.delete('/purchase-record/delete/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM sales WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting purchase record:', err);
            return res.status(500).json({ success: false, error: 'Failed to delete record' });
        }
        res.json({ success: true });
    });
});


// Get all purchase return records with optional filters for buyer, container, start date, and end date
app.get('/purchase-returns', (req, res) => {
    const { buyer, container, start_date, end_date } = req.query;

    let query = `
        SELECT id, return_date, particulars, returned_kg, returned_price_per_kg, total_amount, buyer_id, container_id 
        FROM purchase_returns
        WHERE 1=1
    `;
    const params = [];

    if (buyer && buyer !== "0") {
        query += ` AND buyer_id = ?`;
        params.push(buyer);
    }

    if (container && container !== "0") {
        query += ` AND container_id = ?`;
        params.push(container);
    }

    if (start_date) {
        query += ` AND return_date >= ?`;
        params.push(start_date);
    }

    if (end_date) {
        query += ` AND return_date <= ?`;
        params.push(end_date);
    }

    query += ` ORDER BY return_date DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get a specific return record by ID, including buyer name and container number
app.get('/purchase-return/:id', (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT pr.id, pr.return_date, pr.buyer_id, pr.container_id, pr.returned_kg, pr.returned_price_per_kg, pr.total_amount, 
               b.name AS buyer_name, c.container_number  -- Fetch container_number here
        FROM purchase_returns pr
        LEFT JOIN buyers b ON pr.buyer_id = b.id
        LEFT JOIN containers c ON pr.container_id = c.id  -- Join with containers table to get the container name
        WHERE pr.id = ?
    `;

    db.get(query, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Return record not found' });
        }
        res.json(row);  // Send the return record with buyer_name and container_number
    });
});

// Update a purchase return record, including buyer_id, container_id, return_date, returned_kg, returned_price_per_kg, and total_amount
app.put('/purchase-return/update', (req, res) => {
    const { id, return_date, returned_kg, returned_price_per_kg, total_amount } = req.body;

    // Log the incoming data to see the structure
    console.log('Update request data:', req.body);

    // Update query without the container_id (as it's not submitted)
    const query = `
        UPDATE purchase_returns 
        SET return_date = ?, returned_kg = ?, returned_price_per_kg = ?, total_amount = ? 
        WHERE id = ?
    `;

    db.run(query, [return_date, returned_kg, returned_price_per_kg, total_amount, id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});



// Delete a return record by ID
app.delete('/purchase-return/delete/:id', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Return ID is required' });
    }

    db.run('DELETE FROM purchase_returns WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json({ success: true });
    });
});

// Get the container name by ID (Fetch container name based on container_id)
app.get('/container-name/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT container_number FROM containers WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Container not found' });
        }
        res.json(row);  // Send the container's name (container_number)
    });
});

// Get buyer details by buyer_id
app.get('/buyers/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM buyers WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Buyer not found' });
        }
        res.json(row);
    });
});


// Get a specific payment record by ID
app.get('/payment/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM payment_history WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row);
    });
});

// Update a payment record
app.put('/payment/update', (req, res) => {
    const { id, buyer_name, payment_date, particulars, bank_amount, cash_amount, payment_method } = req.body;

    console.log('Updating payment with data:', { id, buyer_name, payment_date, particulars, bank_amount, cash_amount, payment_method });

    const query = 'UPDATE payment_history SET payment_date = ?, particulars = ?, bank_amount = ?, cash_amount = ?, buyer_name = ?, payment_method = ? WHERE id = ?';
    
    db.run(query, [payment_date, particulars, bank_amount, cash_amount, buyer_name, payment_method, id], function (err) {
        if (err) {
            console.error('Error updating payment:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});


// Delete a payment record
app.delete('/payment/delete/:id', (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Payment ID is required' });
    }

    db.run('DELETE FROM payment_history WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

app.get('/sales/total-sold', (req, res) => {
    const query = `
        SELECT container_id, SUM(weight_sold) AS total_sold
        FROM sales
        GROUP BY container_id
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const salesData = {};
        rows.forEach(row => {
            salesData[row.container_id] = row.total_sold;
        });
        res.json(salesData);
    });
});
app.get('/purchase-returns/total-returned', (req, res) => {
    const query = `
        SELECT container_id, SUM(returned_kg) AS total_returned
        FROM purchase_returns
        GROUP BY container_id
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const returnsData = {};
        rows.forEach(row => {
            returnsData[row.container_id] = row.total_returned;
        });
        res.json(returnsData);
    });
});

// DELETE request to delete a container
app.delete('/container/delete/:id', (req, res) => {
    const containerId = req.params.id;

    // Delete the container from the database
    const query = 'DELETE FROM containers WHERE id = ?';

    db.run(query, [containerId], function (err) {
        if (err) {
            console.error('Error deleting container:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to delete container' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Container not found' });
        }

        res.json({ success: true, message: 'Container deleted successfully' });
    });
});


// Start the Server
app.listen(process.env.PORT || port, () => {
    console.log(`Listening on port ${port}`);
});
