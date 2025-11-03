let containerData = []; // Store fetched container data for filtering

// Helper functions for formatting numbers
function formatNumberWithCommas(value) {
    return !isNaN(value) && value !== '' ? parseFloat(value).toLocaleString('en-US') : value;
}

function getRawNumber(value) {
    return parseFloat(value.toString().replace(/,/g, '')) || 0;
}

// Fetch buyers to populate the dropdown
function fetchBuyers() {
    fetch('/buyers/list')
        .then(response => response.json())
        .then(data => {
            const buyerFilter = document.getElementById('buyer-filter');
            buyerFilter.innerHTML = '<option value="all" data-id="0">All Buyers</option>'; // Default option

            data.forEach(buyer => {
                const option = document.createElement('option');
                option.value = buyer.name;
                option.textContent = buyer.name;
                option.setAttribute('data-id', buyer.id); // Store buyer ID in option
                buyerFilter.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching buyers:', error));
}

// Buyer search box functionality
document.getElementById('buyer-search-box').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const buyerFilter = document.getElementById('buyer-filter');
    const options = buyerFilter.getElementsByTagName('option');

    // Loop through the options and hide those that don't match the search value
    Array.from(options).forEach(option => {
        const optionText = option.text.toLowerCase();
        option.style.display = optionText.includes(searchValue) ? '' : 'none';
    });
});

// Fetch sales + returns + discounts with filtering (no date filter)
function fetchSalesAndReturns(buyerName = 'all') {
    // 1) Fetch buyers first
    fetch('/buyers/list')
        .then(response => response.json())
        .then(buyersData => {
            // 2) Fetch all data in parallel
            const query = `/sales/statement?buyer_name=${encodeURIComponent(buyerName)}`;
            return Promise.all([
                Promise.resolve(buyersData),
                fetch(query).then(r => r.json()),
                fetch('/purchase-return/list').then(r => r.json()),
                fetch('/discounts/list').then(r => r.json()) // NEW: discounts
            ]);
        })
        .then(([buyersData, salesData, purchaseReturnsData, discountsData]) => {
            updateSalesTable(salesData, purchaseReturnsData, buyersData, discountsData); // pass discounts
        })
        .catch(error => {
            console.error('❌ Error in fetchSalesAndReturns:', error);
            const err = document.getElementById('error-message');
            if (err) err.style.display = 'block';
        });
}

// ✅ Update Sales Table Dynamically (aggregates per buyer to avoid double counting)
function updateSalesTable(salesData, purchaseReturnsData, buyersData, discountsData) {
    const tableBody = document.getElementById('sales-statement-table').querySelector('tbody');
    tableBody.innerHTML = ''; // Clear previous rows

    // Footer totals
    let totalPurchase = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalAdvanceReceipt = 0; // negative OB summed here
    let totalDiscount = 0;       // NEW: sum of discounts

    // Serial number
    let serialNumber = 1;

    // Build lookup maps
    const buyerIdByName = {};
    buyersData.forEach(b => { buyerIdByName[b.name] = b.id; });

    // --- Aggregate raw sales per buyer first ---
    // salesData can have multiple rows per buyer; we collapse them.
    const salesAgg = new Map();
    (salesData || []).forEach(rec => {
        const name = rec.buyer_name || 'N/A';
        const prev = salesAgg.get(name) || { total_purchase: 0, total_paid: 0, total_unpaid: 0 };
        prev.total_purchase += Number(rec.total_purchase || 0);
        prev.total_paid += Number(rec.total_paid || 0);
        prev.total_unpaid += Number(rec.total_unpaid || 0); // not used in math, but kept for reference
        salesAgg.set(name, prev);
    });

    // Sum returns by buyerId
    const returnsByBuyerId = (purchaseReturnsData || []).reduce((acc, row) => {
        const id = String(row.buyer_id || '');
        const amt = Number(row.total_amount || 0);
        acc[id] = (acc[id] || 0) + amt;
        return acc;
    }, {});

    // Sum discounts by buyer name (your /discounts/list returns buyer_name)
    const discountsByBuyerName = (discountsData || []).reduce((acc, row) => {
        const name = row.buyer_name || 'N/A';
        const amt = Number(row.discount_amount || 0);
        acc[name] = (acc[name] || 0) + amt;
        return acc;
    }, {});

    // Prepare list of buyers we will render (sorted by name for stable order)
    const buyersToRender = Array.from(salesAgg.keys()).sort((a, b) => a.localeCompare(b));

    // Fetch each buyer's opening balance in parallel, compute their row, then render
    const rowPromises = buyersToRender.map(async (buyerName) => {
        const buyerId = buyerIdByName[buyerName];
        if (!buyerId) {
            console.warn(`⚠ No matching buyer_id found for ${buyerName}`);
        }

        // Opening balance
        let openingBalance = 0;
        if (buyerId) {
            try {
                const obRes = await fetch(`/buyers/opening-balance/${buyerId}`);
                if (obRes.ok) {
                    const obData = await obRes.json();
                    openingBalance = Number(obData.opening_balance || 0);
                }
            } catch (e) {
                console.error('❌ Error fetching opening balance for buyer:', buyerName, e);
            }
        }

        const positiveOB = Math.max(0, openingBalance);
        const negativeOB = Math.min(0, openingBalance);

        const agg = salesAgg.get(buyerName) || { total_purchase: 0, total_paid: 0 };
        const totalPurchaseOriginal = Number(agg.total_purchase || 0);
        const totalPaidAmount = Number(agg.total_paid || 0);

        const buyerReturns = buyerId ? (returnsByBuyerId[String(buyerId)] || 0) : 0;
        const totalDiscountForBuyer = Number(discountsByBuyerName[buyerName] || 0);

        // Column calculations
        const adjustedPurchaseAmount = totalPurchaseOriginal - buyerReturns; // purchases minus returns
        const amountCol = adjustedPurchaseAmount + positiveOB;               // + positive opening balance
        const advanceReceiptCol = negativeOB;                                // negative opening balance
        const receiptCol = totalPaidAmount;                                   // total paid
        const discountCol = totalDiscountForBuyer;                            // NEW: discount column

        // Balance after all adjustments
        const balanceCol = amountCol + advanceReceiptCol - receiptCol - discountCol;

        // Update footer totals
        totalPurchase += amountCol;
        totalPaid += receiptCol;
        totalAdvanceReceipt += advanceReceiptCol;
        totalDiscount += discountCol;
        totalUnpaid += balanceCol;

        // Build row HTML
        return `
            <tr>
                <td>${serialNumber++}</td>
                <td>${buyerName}</td>
                <td>${formatNumberWithCommas(amountCol)}</td>
                <td>${formatNumberWithCommas(advanceReceiptCol)}</td>
                <td>${formatNumberWithCommas(receiptCol)}</td>
                <td>${formatNumberWithCommas(discountCol)}</td>
                <td>${formatNumberWithCommas(balanceCol)}</td>
            </tr>
        `;
    });

    Promise.all(rowPromises)
        .then(rows => {
            // Render all rows at once
            tableBody.innerHTML = rows.join('');

            // Update Footer Totals (only set discount cell if it exists in DOM)
            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = formatNumberWithCommas(val);
            };

            setText('sum-total-purchase', totalPurchase);
            setText('sum-total-advance-receipt', totalAdvanceReceipt);
            setText('sum-total-paid', totalPaid);
            setText('sum-total-discount', totalDiscount); // NEW
            setText('sum-total-unpaid', totalUnpaid);
        })
        .catch(err => console.error('❌ Error building table rows:', err));
}

function renderTable(buyerData) {
    const tableBody = document.getElementById('sales-statement-table').querySelector('tbody');
    tableBody.innerHTML = ''; // Clear any previous rows

    // Loop through buyerData and create a row for each buyer
    buyerData.forEach((buyer, index) => {
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${buyer.name}</td>
                <td>${buyer.amount}</td>
                <td>${buyer.advanceReceipt}</td>
                <td>${buyer.receipt}</td>
                <td>${buyer.balance}</td>
            </tr>
        `;
        tableBody.innerHTML += row; // Add the row to the table body
    });
}

// ✅ Function to Fetch and Update Balance Table (legacy, only call if you have updateBalanceTable)
function fetchSalesAndBalanceUpdates() {
    fetch('/buyers/list')
        .then(response => response.json())
        .then(buyersData => {
            fetch('/sales/statement')
                .then(response => response.json())
                .then(salesData => {
                    fetch('/purchase-return/list')
                        .then(response => response.json())
                        .then(purchaseReturnsData => {
                            // NOTE: updateBalanceTable is not defined in your snippet.
                            // If you don't use this, you can remove this whole function.
                            updateBalanceTable(salesData, purchaseReturnsData, buyersData);
                        })
                        .catch(error => console.error('❌ Error fetching purchase return data:', error));
                })
                .catch(error => console.error('❌ Error fetching sales statement:', error));
        })
        .catch(error => console.error('❌ Error fetching buyers:', error));
}

// ✅ Add event listener for filters (without date filter)
document.getElementById('apply-filters').addEventListener('click', function () {
    const buyerName = document.getElementById('buyer-filter').value;
    console.log(`🔍 Applying filters: Buyer=${buyerName}`);
    fetchSalesAndReturns(buyerName); // ✅ Pass selected buyer filter
});


// Add event listener for export to Excel
document.getElementById('export-sales-statement').addEventListener('click', function () {
    const table = document.getElementById('sales-statement-table');
    const workbook = XLSX.utils.table_to_book(table, { sheet: "Sales Statement" });
    const fileName = `Sales_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
});

        // Function to export table to PDF
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Ensure buyer dropdown exists
    const buyerDropdown = document.getElementById('buyer-filter'); 
    const selectedBuyerId = buyerDropdown.options[buyerDropdown.selectedIndex]?.getAttribute('data-id') || "0"; // Get selected buyer's ID
    const buyerName = buyerDropdown.value === "all" ? "All Buyers" : buyerDropdown.value; // Ensure "All Buyers" is displayed

    // Replace spaces with underscores in the buyer's name, but keep "All_Buyers" for consistency
    const sanitizedBuyerName = buyerDropdown.value === "all" ? "All_Buyers" : buyerName.replace(/\s+/g, "_");

    // Get current date and time
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).replace(/\//g, "-"); // Convert to "DD-MM-YYYY"

    let formattedTime = currentDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    formattedTime = formattedTime.replace(/[:\s]/g, "-").toUpperCase(); // Convert time to uppercase "HH-MM-AM/PM"

    // **Generate filename without location**
    const fileName = `Sales_Statement_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.pdf`;

    // Fetch Buyer Location if a specific buyer is selected and has an ID
    let buyerLocation = '';
    if (selectedBuyerId !== "0") { 
        fetch(`/buyers/location/${selectedBuyerId}`)
            .then(response => response.json())
            .then(data => {
                buyerLocation = data.location || ''; // Assign buyer's location if available
                generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
            })
            .catch(error => {
                console.error('Error fetching buyer location:', error);
                generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
            });
    } else {
        generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
    }
}

function generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName) {
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const headerBarHeight = 18
  let startY = headerBarHeight + 30

  const watermarkImg = new Image()
  watermarkImg.src = '/public/watermark.png'

  watermarkImg.onload = function () {

    // draw header + watermark on every page
    function drawHeader(pageNumber) {
      // watermark
      doc.setGState(new doc.GState({ opacity: 0.2 }))
      const wx = pageWidth / 4
      const wy = pageHeight / 3
      const ww = pageWidth / 2
      const wh = pageHeight / 4
      doc.addImage(watermarkImg, 'PNG', wx, wy, ww, wh)
      doc.setGState(new doc.GState({ opacity: 1 }))

      // header bar
      doc.setFillColor(49, 178, 230)
      doc.rect(0, 0, pageWidth, headerBarHeight, 'F')
      try {
        doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10)
      } catch (e) {
        // ignore if logo not found
      }
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('Sales Statement', pageWidth - 50, 11)

      // invoice block only on first page
      if (pageNumber === 1) {
        const y = 30
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text('INVOICE TO:', 14, y)
        doc.setFont('helvetica', 'normal')
        doc.text(buyerName, 14, y + 5)

        if (buyerLocation) {
          doc.text(buyerLocation, 14, y + 10)
        }

        const dateLabel = 'DATE:'
        const dateText = `${formattedDate}`
        const labelW = doc.getTextWidth(dateLabel)
        const x = pageWidth - labelW - 40
        doc.setFont('helvetica', 'bold')
        doc.text(dateLabel, x, y)
        doc.setFont('helvetica', 'normal')
        doc.text(dateText, x, y + 5)
      }
    }

    // build table
    const table = document.getElementById('sales-statement-table')

    doc.autoTable({
      html: table,
      theme: 'grid',
      startY: startY,
      margin: { horizontal: 10, top: 20, bottom: 40 },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0]
      },
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontSize: 8,
        fontStyle: 'bold'
      },
      pageBreak: 'auto',
      showHead: 'everyPage',
      showFoot: 'lastPage',
      didDrawPage: function (data) {
        drawHeader(data.pageNumber)
        if (data.pageNumber > 1) {
          startY = data.cursor + 30
        }
      }
    })

    // footer ONLY on last page
    const totalPages = doc.internal.getNumberOfPages()
    doc.setPage(totalPages)

    const line1 = 'Thank You For Your Business'
    const line2 = 'Generated by bYTE Ltd.'
    const line3 = 'For inquiries, contact support@lsgroup.com.bd'

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(
      line1,
      (pageWidth - doc.getTextWidth(line1)) / 2,
      pageHeight - 30
    )

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(
      line2,
      (pageWidth - doc.getTextWidth(line2)) / 2,
      pageHeight - 20
    )
    doc.text(
      line3,
      (pageWidth - doc.getTextWidth(line3)) / 2,
      pageHeight - 15
    )

    doc.save(fileName)
  }
}




document.addEventListener("DOMContentLoaded", function() {
    // Get the dropdown button and menu
    const dropdownButton = document.querySelector(".dropbtn");
    const dropdownContent = document.querySelector(".dropdown-content");

    // Toggle dropdown visibility when button is clicked
    dropdownButton.addEventListener("click", function(event) {
        // Prevent the event from bubbling up to the document
        event.stopPropagation();

        // Toggle the display of the dropdown
        dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
    });

    // Hide the dropdown if the user clicks anywhere else on the document
    document.addEventListener("click", function() {
        dropdownContent.style.display = "none";
    });
});

// ✅ Fetch initial data and populate buyers
fetchBuyers();
fetchSalesAndReturns(); // Start fetching sales data and rendering
