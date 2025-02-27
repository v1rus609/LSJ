// Import the SQLite Cloud driver
const { Database } = require('@sqlitecloud/drivers');

// Connect to SQLite Cloud
const db = new Database('sqlitecloud://cksyvf4pnk.g6.sqlite.cloud:8860/database.db?apikey=LYNMd1zowmqh5nTC6c4HP9WN9Ja12zYpmq7a1fwAONM'); // Replace with your connection URL

// Middleware to parse incoming request bodies
const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const generateInvoice = require('./invoiceGenerator');
const generatePaymentHistoryPDF = require('./generatePaymentHistoryPDF');
const generateAllBuyersInvoice = require('./generateAllBuyersInvoice');
const generateSalesStatementPDF = require('./generateSalesStatementPDF');
const fs = require('fs');

const app = express();
const port = 5000;

app.use('/invoices', express.static(path.join(__dirname, 'invoices')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));



// Routes
app.use('/containers', require('./routes/containers'));

const buyersRoutes = require('./routes/buyers');
app.use('/buyers', buyersRoutes);

app.use('/public', express.static(path.join(__dirname, 'public')));

// Add a New Buyer
app.post('/buyers/add', (req, res) => {
    const { name, location, contact_number, paid_amount, unpaid_amount, total_amount } = req.body;

    if (!name || !location || !contact_number || paid_amount || unpaid_amount  || total_amount ) {
        return res.status(400).send('All fields are required.');
    }

    const insertQuery = `
        INSERT INTO buyers (name, location, contact_number, paid_amount, unpaid_amount, total_amount)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(insertQuery, [name, location, contact_number, paid_amount, unpaid_amount, total_amount], function (err) {
        if (err) {
            console.error('Error inserting buyer:', err.message);
            return res.status(500).send('Error saving buyer.');
        }
        res.redirect('/buyers.html?message=Buyer%20added%20successfully');
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

// Export Payment History to PDF
app.post('/payments/export-pdf', async (req, res) => {
    const { payments, totalReceived, selectedBuyer } = req.body;

    console.log('Request Body:', req.body);

    let buyerDetails = { name: 'All Buyers', location: '' };

    // Validate selectedBuyer
    const trimmedBuyer =
        selectedBuyer && typeof selectedBuyer === 'string' && selectedBuyer.trim() !== ''
            ? selectedBuyer.trim()
            : 'all';

    console.log('Trimmed Buyer:', trimmedBuyer);

    if (trimmedBuyer !== 'all') {
        db.get('SELECT name, location FROM buyers WHERE LOWER(name) = LOWER(?)', [trimmedBuyer], (err, row) => {
            if (err) {
                console.error('Error fetching buyer details:', err.message);
                return res.status(500).send('Error fetching buyer details.');
            }

            console.log('Database Query Result:', row);

            if (!row) {
                console.warn(`Buyer not found for the given name: "${trimmedBuyer}"`);
                buyerDetails = { name: trimmedBuyer, location: 'Unknown Location' };
            } else {
                buyerDetails = row;
            }

            generatePaymentHistoryPDF(payments, totalReceived, trimmedBuyer, buyerDetails)
                .then((filePath) => {
                    res.json({ success: true, filePath: `/exports/${path.basename(filePath)}` });
                })
                .catch((error) => {
                    console.error('Error exporting PDF:', error);
                    res.status(500).json({ success: false, error: 'Failed to generate PDF.' });
                });
        });
    } else {
        console.log('Generating PDF for All Buyers');
        generatePaymentHistoryPDF(payments, totalReceived, trimmedBuyer, buyerDetails)
            .then((filePath) => {
                res.json({ success: true, filePath: `/exports/${path.basename(filePath)}` });
            })
            .catch((error) => {
                console.error('Error exporting PDF:', error);
                res.status(500).json({ success: false, error: 'Failed to generate PDF.' });
            });
    }
});


// Fetch Purchase History
app.get('/purchases', (req, res) => {
    const { buyer, container } = req.query;

    let query = `
        SELECT
            sales.id AS sale_id,
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
            return res.status(500).send('Error fetching purchase history.');
        }
        res.json(rows);
    });
});



// Dashboard Metrics
// Dashboard Metrics with Fixed Total Unpaid Calculation
app.get('/dashboard-metrics', (req, res) => {
    const queryTotalSell = `SELECT IFNULL(SUM(total_price), 0) AS total_sell FROM sales`;
    const queryTotalPurchaseReturns = `SELECT IFNULL(SUM(total_amount), 0) AS total_purchase_returns FROM purchase_returns`;

    // ✅ Corrected Total Paid = Sales paid_amount + Payment History (Cash + Bank)
    const queryTotalPaid = `
        SELECT 
            IFNULL(SUM(sales.paid_amount), 0) + 
            IFNULL((SELECT SUM(cash_amount + bank_amount) FROM payment_history), 0) AS total_paid
        FROM sales`;

    const queryTotalBuyers = `SELECT COUNT(*) AS total_buyers FROM buyers`;
    const queryTotalContainers = `SELECT COUNT(*) AS total_containers FROM containers`;

    db.serialize(() => {
        let metrics = {
            total_sell: 0,
            total_purchase_returns: 0,
            total_paid: 0,
            total_unpaid: 0,
            total_buyers: 0,
            total_containers: 0
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

        // ✅ Ensure calculations happen after all queries complete
        setTimeout(() => {
            // ✅ Calculate Net Sales
            metrics.net_sale = metrics.total_sell - metrics.total_purchase_returns;
            console.log(`💰 Net Sales Calculated: ${metrics.net_sale}`);

            // ✅ FIX: Calculate Total Unpaid Correctly
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

app.post('/generate-invoice', async (req, res) => {
    const { buyer_id, total_paid } = req.body;

    if (!buyer_id) {
        return res.status(400).json({ error: 'Buyer ID is required.' });
    }

    console.log('Generating invoice for buyer:', buyer_id);

    // Fetch buyer details
    db.get(`SELECT name, location FROM buyers WHERE id = ?`, [buyer_id], (err, buyer) => {
        if (err || !buyer) {
            return res.status(500).json({ error: 'Error fetching buyer details.' });
        }

        // Fetch all purchase details for the buyer
        db.all(
            `SELECT
                containers.container_number,
                sales.weight_sold,
                sales.price_per_kg,
                sales.purchase_date,
                sales.paid_amount,
                sales.unpaid_amount,
                sales.total_price
            FROM sales
            JOIN containers ON sales.container_id = containers.id
            WHERE sales.buyer_id = ?
            ORDER BY sales.purchase_date DESC`,
            [buyer_id],
            async (err, purchases) => {
                if (err || purchases.length === 0) {
                    return res.status(500).json({ error: 'No purchases found for this buyer.' });
                }

                try {
                    const invoiceNo = `INV-${Date.now()}`;
                    const filePath = await generateInvoice({ buyer, purchases, total_paid }, invoiceNo);
                    res.json({ success: true, invoicePath: `/invoices/${path.basename(filePath)}` });
                } catch (error) {
                    console.error('Error generating invoice:', error);
                    res.status(500).json({ success: false, error: 'Failed to generate invoice.' });
                }
            }
        );
    });
});

// New route to handle "Generate Invoice for All Buyers"
app.post('/generate-all-buyers-invoice', async (req, res) => {
    const { purchases, total_paid, total_unpaid, grand_total } = req.body;

    // Check if the purchases array is empty
    if (!purchases || purchases.length === 0) {
        return res.status(400).json({ success: false, error: 'No purchase data available for invoice generation.' });
    }

    // Ensure that even if totals are 0, the invoice still proceeds
    try {
        const invoiceNo = `INV-${Date.now()}`;
        const filePath = await generateAllBuyersInvoice(purchases, total_paid, total_unpaid, grand_total, invoiceNo);
        res.json({ success: true, invoicePath: `/invoices/${path.basename(filePath)}` });
    } catch (error) {
        console.error('Error generating invoice for all buyers:', error);
        res.status(500).json({ success: false, error: `Failed to generate invoice: ${error.message}` });
    }
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
        SELECT id, payment_date, particulars, bank_amount, cash_amount, buyer_name,
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






// Export Sales Statement to PDF
app.post('/sales/export-pdf', async (req, res) => {
    const { sales, totals } = req.body;

    try {
        // Generate PDF file
        const filePath = await generateSalesStatementPDF(sales, totals);

        // Respond with the file path
        res.json({ success: true, filePath: `/exports/${path.basename(filePath)}` });
    } catch (error) {
        console.error('Error exporting sales statement PDF:', error);
        res.status(500).json({ success: false, error: 'Failed to generate PDF.' });
    }
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


// ✅ **API: Fetch Updated Containers List**
app.get('/containers/list', (req, res) => {
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
               total_price AS bill_amount
        FROM sales
        JOIN containers ON sales.container_id = containers.id
        WHERE buyer_id = ?`;

    const queryPayments = `
        SELECT payment_date AS date, 'Payment' AS type, 
               'Payment: ' || payment_method AS particulars,
               payment_history.particulars AS details,
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
            sales.id AS sale_id,
            buyers.name AS buyer_name,  -- Join buyers table to get the buyer name
            sales.purchase_date,
            sales.weight_sold,
            sales.price_per_kg,
            sales.paid_amount,
            sales.unpaid_amount,
            sales.total_price
        FROM sales
        JOIN buyers ON sales.buyer_id = buyers.id  -- Join the buyers table on buyer_id
        WHERE sales.id = ?
    `;

    db.get('SELECT sales.id AS sale_id, sales.buyer_id, buyers.name AS buyer_name, sales.purchase_date, sales.weight_sold, sales.price_per_kg, sales.paid_amount, sales.unpaid_amount, sales.total_price FROM sales JOIN buyers ON sales.buyer_id = buyers.id WHERE sales.id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error fetching purchase record:', err);
            return res.status(500).send('Error fetching purchase record');
        }
        if (result) {
            res.json(result); // Now the result includes buyer_id
        } else {
            res.status(404).json({ error: 'Record not found' });
        }
    });
});



// Update a purchase record
app.put('/purchase-record/update', (req, res) => {
    console.log('Request body:', req.body);  // Log the incoming request body

    const { purchase_date, buyer_id, weight_sold, price_per_kg, paid_amount, unpaid_amount, total_price, id } = req.body;

    // Validation
    if (!buyer_id) {
        console.error('Buyer ID is missing');
        return res.status(400).json({ success: false, error: 'Buyer ID is required' });
    }
    if (!purchase_date || !weight_sold || !price_per_kg || !paid_amount || !unpaid_amount || !total_price || !id) {
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
			SET purchase_date = ?, buyer_id = ?, weight_sold = ?, price_per_kg = ?, paid_amount = ?, unpaid_amount = ?, total_price = ? 
			WHERE id = ?
		`;

        const params = [purchase_date, buyer_id, weight_sold, price_per_kg, paid_amount, unpaid_amount, total_price, id];

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
