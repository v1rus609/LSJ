// Import the SQLite Cloud driver
const { Database } = require('@sqlitecloud/drivers');

// Connect to SQLite Cloud
const db = new Database('sqlitecloud://cksyvf4pnk.g6.sqlite.cloud:8860/database.db?apikey=LYNMd1zowmqh5nTC6c4HP9WN9Ja12zYpmq7a1fwAONM'); // Replace with your connection URL

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const PDFDocument = require('pdfkit');
const generateInvoice = require('./invoiceGenerator');
const generatePaymentHistoryPDF = require('./generatePaymentHistoryPDF');
const generateAllBuyersInvoice = require('./generateAllBuyersInvoice');  // Adjust path as needed
const generateSalesStatementPDF = require('./generateSalesStatementPDF'); // Import the PDF generation function
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
app.post('/buyers/add', async (req, res) => {
    const { name, location, contact_number, paid_amount, unpaid_amount, total_amount } = req.body;

    if (!name || !location || !contact_number || paid_amount === undefined || unpaid_amount === undefined || total_amount === undefined) {
        return res.status(400).send('All fields are required.');
    }

    const insertQuery = `
        INSERT INTO buyers (name, location, contact_number, paid_amount, unpaid_amount, total_amount)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {
        // Execute the query using @sqlitecloud/drivers
        await db.run(insertQuery, [name, location, contact_number, paid_amount, unpaid_amount, total_amount]);
        res.redirect('/buyers.html?message=Buyer%20added%20successfully');
    } catch (err) {
        console.error('Error inserting buyer:', err.message);
        return res.status(500).send('Error saving buyer.');
    }
});

// Fetch Buyer List
app.get('/buyers/list', async (req, res) => {
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

    try {
        // Execute the query using @sqlitecloud/drivers
        const rows = await db.all(query, []);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching buyers:', err.message);
        return res.status(500).send('Error fetching buyers.');
    }
});

// Fetch Payment History
app.get('/payments/history', async (req, res) => {
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

    try {
        // Execute the query using @sqlitecloud/drivers
        const rows = await db.all(query, params);
        console.log('Payment history fetched:', rows); // Debug log
        const totalReceived = rows.reduce((sum, row) => sum + row.total, 0);

        res.json({ payments: rows, totalReceived });
    } catch (err) {
        console.error('Error fetching payment history:', err.message);
        return res.status(500).send('Error fetching payment history.');
    }
});

const path = require('path');

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

    try {
        if (trimmedBuyer !== 'all') {
            // Fetch buyer details using @sqlitecloud/drivers
            const row = await db.get('SELECT name, location FROM buyers WHERE LOWER(name) = LOWER(?)', [trimmedBuyer]);

            console.log('Database Query Result:', row);

            if (!row) {
                console.warn(`Buyer not found for the given name: "${trimmedBuyer}"`);
                buyerDetails = { name: trimmedBuyer, location: 'Unknown Location' };
            } else {
                buyerDetails = row;
            }
        }

        console.log('Generating PDF for:', trimmedBuyer !== 'all' ? buyerDetails.name : 'All Buyers');
        // Generate the PDF for payment history
        const filePath = await generatePaymentHistoryPDF(payments, totalReceived, trimmedBuyer, buyerDetails);

        res.json({ success: true, filePath: `/exports/${path.basename(filePath)}` });
    } catch (error) {
        console.error('Error exporting PDF:', error);
        res.status(500).json({ success: false, error: 'Failed to generate PDF.' });
    }
});

// Fetch Purchase History
app.get('/purchases', async (req, res) => {
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

    try {
        // Execute the query using @sqlitecloud/drivers
        const rows = await db.all(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching purchase history:', err.message);
        return res.status(500).send('Error fetching purchase history.');
    }
});

// Dashboard Metrics with Fixed Total Unpaid Calculation
app.get('/dashboard-metrics', async (req, res) => {
    const queryTotalSell = `SELECT IFNULL(SUM(total_price), 0) AS total_sell FROM sales`;
    const queryTotalPurchaseReturns = `SELECT IFNULL(SUM(total_amount), 0) AS total_purchase_returns FROM purchase_returns`;

    // Corrected Total Paid = Sales paid_amount + Payment History (Cash + Bank)
    const queryTotalPaid = `
        SELECT 
            IFNULL(SUM(sales.paid_amount), 0) + 
            IFNULL((SELECT SUM(cash_amount + bank_amount) FROM payment_history), 0) AS total_paid
        FROM sales`;

    const queryTotalBuyers = `SELECT COUNT(*) AS total_buyers FROM buyers`;
    const queryTotalContainers = `SELECT COUNT(*) AS total_containers FROM containers`;

    try {
        console.log("🔍 Fetching dashboard metrics...");

        const metrics = {
            total_sell: 0,
            total_purchase_returns: 0,
            total_paid: 0,
            total_unpaid: 0,
            total_buyers: 0,
            total_containers: 0
        };

        // Fetch all metrics using await
        const totalSellRow = await db.get(queryTotalSell);
        metrics.total_sell = totalSellRow.total_sell || 0;
        console.log(`🟢 Total Sales: ${metrics.total_sell}`);

        const totalPurchaseReturnsRow = await db.get(queryTotalPurchaseReturns);
        metrics.total_purchase_returns = totalPurchaseReturnsRow.total_purchase_returns || 0;
        console.log(`🟠 Total Purchase Returns: ${metrics.total_purchase_returns}`);

        const totalPaidRow = await db.get(queryTotalPaid);
        metrics.total_paid = totalPaidRow.total_paid || 0;
        console.log(`🔵 Total Paid: ${metrics.total_paid}`);

        const totalBuyersRow = await db.get(queryTotalBuyers);
        metrics.total_buyers = totalBuyersRow.total_buyers || 0;
        console.log(`👥 Total Buyers: ${metrics.total_buyers}`);

        const totalContainersRow = await db.get(queryTotalContainers);
        metrics.total_containers = totalContainersRow.total_containers || 0;
        console.log(`📦 Total Containers: ${metrics.total_containers}`);

        // Calculate Net Sales and Total Unpaid after fetching all the data
        metrics.net_sale = metrics.total_sell - metrics.total_purchase_returns;
        console.log(`💰 Net Sales Calculated: ${metrics.net_sale}`);

        // FIX: Calculate Total Unpaid Correctly
        metrics.total_unpaid = metrics.net_sale - metrics.total_paid;
        if (isNaN(metrics.total_unpaid)) metrics.total_unpaid = 0; // Prevent NaN

        console.log(`📊 Final Metrics:\n`, metrics);

        res.json(metrics);
    } catch (err) {
        console.error('Error fetching dashboard metrics:', err.message);
        return res.status(500).send('Error fetching dashboard metrics.');
    }
});

// Handle received payment
app.post('/payments/receive', async (req, res) => {
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

    try {
        // Execute the query using @sqlitecloud/drivers
        const result = await db.run(updateSaleQuery, [payment_amount, payment_amount, sale_id, payment_amount]);
        
        // Check if any rows were updated
        if (result.changes === 0) {
            return res.status(400).json({ error: 'Payment amount exceeds the unpaid amount or sale not found.' });
        }

        res.send('Payment processed successfully.');
    } catch (err) {
        console.error('Error updating payment:', err.message);
        return res.status(500).json({ error: 'Failed to process payment.' });
    }
});

// Generate Invoice
app.post('/generate-invoice', async (req, res) => {
    const { buyer_id, total_paid } = req.body;

    if (!buyer_id) {
        return res.status(400).json({ error: 'Buyer ID is required.' });
    }

    console.log('Generating invoice for buyer:', buyer_id);

    try {
        // Fetch buyer details
        const buyer = await db.get(`SELECT name, location FROM buyers WHERE id = ?`, [buyer_id]);

        if (!buyer) {
            return res.status(500).json({ error: 'Error fetching buyer details.' });
        }

        // Fetch all purchase details for the buyer
        const purchases = await db.all(
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
            [buyer_id]
        );

        if (purchases.length === 0) {
            return res.status(500).json({ error: 'No purchases found for this buyer.' });
        }

        // Generate invoice
        const invoiceNo = `INV-${Date.now()}`;
        const filePath = await generateInvoice({ buyer, purchases, total_paid }, invoiceNo);

        res.json({ success: true, invoicePath: `/invoices/${path.basename(filePath)}` });

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ success: false, error: 'Failed to generate invoice.' });
    }
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
app.post('/payments/distribute', async (req, res) => {
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

    try {
        // Fetch unpaid balance
        const result = await db.get(queryUnpaidBalance, [buyer_id, buyer_id]);

        const totalUnpaid = result?.total_unpaid || 0;
        if (payment_amount > totalUnpaid) {
            return res.status(400).json({ error: `Payment exceeds the total unpaid amount of ${totalUnpaid}.` });
        }

        // Fetch buyer name
        const buyerNameQuery = `SELECT name FROM buyers WHERE id = ?`;
        const buyer = await db.get(buyerNameQuery, [buyer_id]);
        if (!buyer) {
            console.error('Buyer not found');
            return res.status(500).json({ error: 'Error fetching buyer name.' });
        }

        const buyerName = buyer.name;

        // Fetch unpaid sales for the buyer
        const salesQuery = `
            SELECT id, unpaid_amount 
            FROM sales 
            WHERE buyer_id = ? AND unpaid_amount > 0 
            ORDER BY id ASC`;

        const rows = await db.all(salesQuery, [buyer_id]);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'No unpaid sales found for this buyer.' });
        }

        let remainingAmount = payment_amount;
        const updates = [];

        // Calculate updates for unpaid sales
        for (const sale of rows) {
            if (remainingAmount <= 0) break;

            const amountToDeduct = Math.min(remainingAmount, sale.unpaid_amount);
            remainingAmount -= amountToDeduct;

            updates.push({
                sale_id: sale.id,
                amountToDeduct,
            });
        }

        // Apply updates to sales and insert payment history
        const applyUpdates = async () => {
            if (updates.length === 0) {
                const bankAmount = payment_method === 'bank' ? payment_amount : 0;
                const cashAmount = payment_method === 'cash' ? payment_amount : 0;

                await db.run(
                    `INSERT INTO payment_history (payment_date, particulars, bank_amount, cash_amount, buyer_name, buyer_id)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [payment_date, particulars, bankAmount, cashAmount, buyerName, buyer_id]
                );

                return res.json({ success: true });
            } else {
                const update = updates.shift();

                await db.run(
                    `UPDATE sales
                     SET paid_amount = paid_amount + ?, unpaid_amount = unpaid_amount - ?
                     WHERE id = ?`,
                    [update.amountToDeduct, update.amountToDeduct, update.sale_id]
                );

                applyUpdates();
            }
        };

        // Start applying the updates
        applyUpdates();

    } catch (err) {
        console.error('Error processing payment:', err.message);
        return res.status(500).json({ error: 'Error processing payment.' });
    }
});

// Fetch Unpaid Amount for a Buyer
app.get('/buyers/unpaid-amount/:buyer_id', async (req, res) => {
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

    try {
        // Fetch total unpaid amount
        const unpaidRow = await db.get(queryTotalUnpaid, [buyerId]);
        console.log(`📊 Buyer ${buyerId} | Total Unpaid from Sales:`, unpaidRow.total_unpaid);

        // Fetch total paid amount
        const paidRow = await db.get(queryTotalPaid, [buyerId]);
        console.log(`💰 Buyer ${buyerId} | Total Paid from Payment History:`, paidRow.total_paid);

        // Fetch total returns
        const returnRow = await db.get(queryTotalReturns, [buyerId]);
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
    } catch (err) {
        console.error('❌ Error fetching data for unpaid amount:', err.message);
        return res.status(500).json({ error: 'Error fetching unpaid amount' });
    }
});

// Add a new payment record
app.post('/payments/history/add', async (req, res) => {
    const { payment_date, particulars, bank_amount, cash_amount, payment_method, buyer_id, buyer_name } = req.body;

    // Validate inputs
    if (!payment_date || !buyer_id || (bank_amount == null && cash_amount == null)) {
        return res.status(400).json({ error: 'Payment date, buyer ID, and at least one payment amount are required.' });
    }

    const query = `
        INSERT INTO payment_history (payment_date, particulars, bank_amount, cash_amount, payment_method, buyer_id, buyer_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        // Insert payment record using @sqlitecloud/drivers
        await db.run(query, [payment_date, particulars, bank_amount || 0, cash_amount || 0, payment_method, buyer_id, buyer_name]);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding payment history:', err.message);
        return res.status(500).json({ error: 'Error saving payment history.' });
    }
});

// Fetch payment history
app.get('/payments/history', async (req, res) => {
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

    try {
        // Execute the query using @sqlitecloud/drivers
        const rows = await db.all(query, params);

        // Calculate total received
        const totalReceived = rows.reduce((sum, row) => sum + row.total, 0);

        res.json({ payments: rows, totalReceived });
    } catch (err) {
        console.error('Error fetching payment history:', err.message);
        return res.status(500).send('Error fetching payment history.');
    }
});

// Fetch sales statement
app.get('/sales/statement', async (req, res) => {
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

    try {
        // Fetch sales data
        const salesRows = await db.all(querySales, params);

        // Fetch payment data
        const paymentRows = await db.all(queryPayments, []);

        // Create a map of payments per buyer
        const paymentsMap = {};
        paymentRows.forEach(row => {
            paymentsMap[row.buyer_id] = row.total_payment || 0;
        });

        // Merge payments into sales data
        const finalData = salesRows.map(sale => ({
            ...sale,
            total_paid: (paymentsMap[sale.buyer_id] || 0) + sale.paid_at_sale, // Sum both sources
            total_unpaid: sale.total_unpaid - (paymentsMap[sale.buyer_id] || 0) - sale.paid_at_sale // Adjust balance correctly
        }));

        res.json(finalData);

    } catch (err) {
        console.error('Error fetching sales statement:', err.message);
        return res.status(500).send('Error fetching sales statement.');
    }
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
app.get('/get-containers-by-buyer', async (req, res) => {
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

    try {
        // Execute the query using @sqlitecloud/drivers
        const results = await db.all(query, [buyerId]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'No containers found for this buyer.' });
        }

        res.json(results);  // Return the list of containers as a JSON response

    } catch (err) {
        console.error('Error fetching containers from sales:', err.message);
        return res.status(500).json({ error: 'Failed to fetch containers.' });
    }
});


// Backend: Purchase Returns with Date Filtering
app.get('/purchase-returns', async (req, res) => {
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

    try {
        // Execute the query using @sqlitecloud/drivers
        const rows = await db.all(query, queryParams);

        res.json(rows);
    } catch (err) {
        console.error('Error fetching purchase returns:', err.message);
        return res.status(500).json({ error: 'Database query error' });
    }
});


// Fetch all containers when no buyer is selected
app.get('/get-all-containers', async (req, res) => {
    const query = 'SELECT * FROM containers'; // Query to fetch all containers from the database

    try {
        // Execute the query asynchronously
        const rows = await db.all(query, []);

        res.json(rows); // Send all containers as the response
    } catch (err) {
        console.error('Error fetching all containers:', err.message);
        return res.status(500).json({ success: false, message: 'Error fetching containers' });
    }
});

// Handle Purchase Return: Only Update Containers Table
app.post('/purchase-return', async (req, res) => {
    const { return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount } = req.body;

    if (!return_date || !buyer_id || !container_id || !returned_kg || !returned_price_per_kg || !total_amount) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        // **Step 1: Insert the return record**
        await db.run(
            `INSERT INTO purchase_returns (return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [return_date, buyer_id, container_id, returned_kg, returned_price_per_kg, total_amount]
        );

        // **Step 2: Update the containers table**
        await db.run(
            `UPDATE containers
             SET remaining_weight = remaining_weight + ? 
             WHERE id = ?`,
            [returned_kg, container_id]
        );

        return res.json({ success: true, message: 'Purchase return recorded successfully' });
    } catch (err) {
        console.error('Error processing purchase return:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to process purchase return' });
    }
});

// Update Sales Statement
app.post('/sales/statement/update/:buyerId', async (req, res) => {
    const { returnedAmount } = req.body;
    const { buyerId } = req.params;

    if (!buyerId || !returnedAmount) {
        return res.status(400).json({ success: false, message: 'Invalid buyer ID or returned amount' });
    }

    try {
        // Update the sales statement
        await db.run(
            `UPDATE sales
             SET total_price = total_price - ?, 
                 unpaid_amount = unpaid_amount - ?
             WHERE id IN (
                 SELECT id FROM sales 
                 WHERE buyer_id = ? 
                 ORDER BY purchase_date DESC 
                 LIMIT 1
             )`,
            [returnedAmount, returnedAmount, buyerId]
        );

        res.json({ success: true, message: 'Sales statement updated successfully' });
    } catch (err) {
        console.error('Error updating sales statement:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update sales statement' });
    }
});

// Fetch Updated Containers List
app.get('/containers/list', async (req, res) => {
    const query = `
        SELECT c.id, c.container_number, c.weight, c.arrival_date, c.remaining_weight,
               (c.weight - c.remaining_weight) AS total_sold
        FROM containers c
    `;
    
    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        const rows = await db.all(query, []);

        res.json(rows);  // Return the containers data as a JSON response
    } catch (err) {
        console.error('Error fetching containers:', err.message);
        return res.status(500).json({ error: 'Failed to fetch containers' });
    }
});

// API to fetch all purchase returns (needed for frontend calculations)
app.get('/purchase-return/list', async (req, res) => {
    const query = `SELECT * FROM purchase_returns`; // Ensure table name is correct

    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        const rows = await db.all(query, []);

        res.json(rows); // Return the purchase returns data as a JSON response
    } catch (err) {
        console.error('Error fetching purchase returns:', err.message);
        return res.status(500).json({ error: 'Failed to fetch purchase return data.' });
    }
});


// Fetch buyer timeline
app.get('/buyer-timeline', async (req, res) => {
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

    try {
        // Fetch purchases, payments, and returns asynchronously
        const [purchases, payments, returns] = await Promise.all([
            db.all(queryPurchases, [buyerId]),
            db.all(queryPayments, [buyerId]),
            db.all(queryReturns, [buyerId])
        ]);

        // Combine all entries and sort by date
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

    } catch (err) {
        console.error('Error fetching buyer timeline:', err.message);
        return res.status(500).json({ error: 'Error fetching buyer timeline' });
    }
});

// Get Containers a Buyer Purchased From
app.get('/buyer-containers/:buyerId', async (req, res) => {
    const { buyerId } = req.params;

    const query = `
        SELECT DISTINCT s.container_id, c.container_number
        FROM sales s
        JOIN containers c ON s.container_id = c.id
        WHERE s.buyer_id = ?
    `;

    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        const rows = await db.all(query, [buyerId]);

        res.json(rows);  // Return the containers data as a JSON response
    } catch (err) {
        console.error('❌ Error fetching buyer containers:', err.message);
        return res.status(500).json({ error: 'Error fetching containers' });
    }
});

// Get Purchase Details for Selected Container
app.get('/container-purchase-details/:buyerId/:containerId', async (req, res) => {
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

    try {
        // Fetch total purchased data
        const totalPurchasedRow = await db.get(queryTotalPurchased, [buyerId, containerId]);
        responseData.total_purchased = totalPurchasedRow.total_purchased;
        responseData.price_per_kg = totalPurchasedRow.price_per_kg;

        // Fetch total returned data
        const totalReturnedRow = await db.get(queryTotalReturned, [buyerId, containerId]);
        responseData.total_returned = totalReturnedRow.total_returned;

        // Send the response after fetching both data
        res.json(responseData);
    } catch (err) {
        console.error('❌ Error fetching purchase details:', err.message);
        return res.status(500).json({ error: 'Error fetching purchase data' });
    }
});

// Route to fetch buyer location by ID
app.get('/buyers/location/:id', async (req, res) => {
    const buyerId = req.params.id;

    const query = "SELECT location FROM buyers WHERE id = ?";

    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        const row = await db.get(query, [buyerId]);

        if (row) {
            res.json({ location: row.location });
        } else {
            res.status(404).json({ error: 'Buyer not found.' });
        }
    } catch (err) {
        console.error('Error fetching buyer location:', err.message);
        return res.status(500).json({ error: 'Error fetching buyer location.' });
    }
});

// Fetch a purchase record for editing
app.get('/purchase-record/:id', async (req, res) => {
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

    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        const result = await db.get(query, [id]);

        if (result) {
            res.json(result); // Send the result as a JSON response
        } else {
            res.status(404).json({ error: 'Record not found' });
        }
    } catch (err) {
        console.error('Error fetching purchase record:', err.message);
        return res.status(500).json({ error: 'Error fetching purchase record' });
    }
});

// Update a purchase record
app.put('/purchase-record/update', async (req, res) => {
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

    try {
        // Ensure that buyer exists in the database
        const buyer = await db.get('SELECT id FROM buyers WHERE id = ?', [buyer_id]);

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

        await db.run(query, params);

        // Log the result of the update
        console.log(`Updated purchase record with ID: ${id}`);
        res.json({ success: true });

    } catch (err) {
        console.error('Error updating purchase record:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to update record' });
    }
});

// Delete a purchase record
app.delete('/purchase-record/delete/:id', async (req, res) => {
    const id = req.params.id;

    try {
        // Execute the delete query asynchronously
        await db.run('DELETE FROM sales WHERE id = ?', [id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting purchase record:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to delete record' });
    }
});

// Get all purchase return records with optional filters for buyer, container, start date, and end date
app.get('/purchase-returns', async (req, res) => {
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

    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        const rows = await db.all(query, params);
        res.json(rows);  // Return the purchase returns data as a JSON response
    } catch (err) {
        console.error('Error fetching purchase returns:', err.message);
        return res.status(500).json({ error: 'Failed to fetch purchase return records.' });
    }
});


// Get a specific return record by ID, including buyer name and container number
app.get('/purchase-return/:id', async (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT pr.id, pr.return_date, pr.buyer_id, pr.container_id, pr.returned_kg, pr.returned_price_per_kg, pr.total_amount, 
               b.name AS buyer_name, c.container_number  -- Fetch container_number here
        FROM purchase_returns pr
        LEFT JOIN buyers b ON pr.buyer_id = b.id
        LEFT JOIN containers c ON pr.container_id = c.id  -- Join with containers table to get the container name
        WHERE pr.id = ?
    `;

    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        const row = await db.get(query, [id]);

        if (!row) {
            return res.status(404).json({ error: 'Return record not found' });
        }

        res.json(row);  // Send the return record with buyer_name and container_number
    } catch (err) {
        console.error('Error fetching purchase return record:', err.message);
        return res.status(500).json({ error: err.message });
    }
});


// Update a purchase return record, including buyer_id, container_id, return_date, returned_kg, returned_price_per_kg, and total_amount
app.put('/purchase-return/update', async (req, res) => {
    const { id, return_date, returned_kg, returned_price_per_kg, total_amount } = req.body;

    // Log the incoming data to see the structure
    console.log('Update request data:', req.body);

    // Update query without the container_id (as it's not submitted)
    const query = `
        UPDATE purchase_returns 
        SET return_date = ?, returned_kg = ?, returned_price_per_kg = ?, total_amount = ? 
        WHERE id = ?
    `;

    try {
        // Execute the query asynchronously using @sqlitecloud/drivers
        await db.run(query, [return_date, returned_kg, returned_price_per_kg, total_amount, id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating purchase return record:', err.message);
        return res.status(500).json({ error: 'Failed to update purchase return record' });
    }
});

// Delete a return record by ID
app.delete('/purchase-return/delete/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Return ID is required' });
    }

    try {
        // Execute the delete query asynchronously using @sqlitecloud/drivers
        const result = await db.run('DELETE FROM purchase_returns WHERE id = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting purchase return record:', err.message);
        return res.status(500).json({ error: 'Failed to delete record' });
    }
});


// Get the container name by ID (Fetch container name based on container_id)
app.get('/container-name/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const row = await db.get('SELECT container_number FROM containers WHERE id = ?', [id]);
        if (!row) {
            return res.status(404).json({ error: 'Container not found' });
        }
        res.json(row);  // Send the container's name (container_number)
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


// Get buyer details by buyer_id
app.get('/buyers/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const row = await db.get('SELECT * FROM buyers WHERE id = ?', [id]);
        if (!row) {
            return res.status(404).json({ error: 'Buyer not found' });
        }
        res.json(row);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


// Get a specific payment record by ID
app.get('/payment/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const row = await db.get('SELECT * FROM payment_history WHERE id = ?', [id]);
        if (!row) {
            return res.status(404).json({ error: 'Payment record not found' });
        }
        res.json(row);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


// Update a payment record
app.put('/payment/update', async (req, res) => {
    const { id, buyer_name, payment_date, particulars, bank_amount, cash_amount, payment_method } = req.body;

    console.log('Updating payment with data:', { id, buyer_name, payment_date, particulars, bank_amount, cash_amount, payment_method });

    const query = 'UPDATE payment_history SET payment_date = ?, particulars = ?, bank_amount = ?, cash_amount = ?, buyer_name = ?, payment_method = ? WHERE id = ?';

    try {
        await db.run(query, [payment_date, particulars, bank_amount, cash_amount, buyer_name, payment_method, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating payment:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// Update a payment record
app.put('/payment/update', async (req, res) => {
    const { id, buyer_name, payment_date, particulars, bank_amount, cash_amount, payment_method } = req.body;

    console.log('Updating payment with data:', { id, buyer_name, payment_date, particulars, bank_amount, cash_amount, payment_method });

    const query = 'UPDATE payment_history SET payment_date = ?, particulars = ?, bank_amount = ?, cash_amount = ?, buyer_name = ?, payment_method = ? WHERE id = ?';

    try {
        await db.run(query, [payment_date, particulars, bank_amount, cash_amount, buyer_name, payment_method, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating payment:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// Get total sold by container
app.get('/sales/total-sold', async (req, res) => {
    const query = `
        SELECT container_id, SUM(weight_sold) AS total_sold
        FROM sales
        GROUP BY container_id
    `;

    try {
        // Execute the query asynchronously
        const rows = await db.all(query, []);
        const salesData = {};

        rows.forEach(row => {
            salesData[row.container_id] = row.total_sold;
        });

        res.json(salesData);
    } catch (err) {
        console.error('Error fetching sales data:', err.message);
        return res.status(500).json({ error: err.message });
    }
});


// Get total returned by container
app.get('/purchase-returns/total-returned', async (req, res) => {
    const query = `
        SELECT container_id, SUM(returned_kg) AS total_returned
        FROM purchase_returns
        GROUP BY container_id
    `;

    try {
        // Execute the query asynchronously
        const rows = await db.all(query, []);
        const returnsData = {};

        rows.forEach(row => {
            returnsData[row.container_id] = row.total_returned;
        });

        res.json(returnsData);
    } catch (err) {
        console.error('Error fetching purchase return data:', err.message);
        return res.status(500).json({ error: err.message });
    }
});


// DELETE request to delete a container
app.delete('/container/delete/:id', async (req, res) => {
    const containerId = req.params.id;

    // Delete the container from the database
    const query = 'DELETE FROM containers WHERE id = ?';

    try {
        const result = await db.run(query, [containerId]);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Container not found' });
        }

        res.json({ success: true, message: 'Container deleted successfully' });
    } catch (err) {
        console.error('Error deleting container:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to delete container' });
    }
});

// Start the Server
app.listen(process.env.PORT || port, () => {
    console.log(`Listening on port ${process.env.PORT || port}`);
});
