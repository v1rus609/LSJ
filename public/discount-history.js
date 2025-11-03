document.addEventListener('DOMContentLoaded', async function () {
    const discountList      = document.getElementById('discount-list');
    const buyerSearchBox    = document.getElementById('buyer-search-box');
    const exportExcelButton = document.getElementById('export-btn');
    const exportPdfButton   = document.getElementById('export-pdf-btn');
    const actionHeader      = document.getElementById('action-column');

    let discountData = [];
    window.isAdmin = true; // will be set properly below

    // 1) check role first
    await checkRole();

    // 2) fetch discounts
    fetch('/discounts/list')
        .then(res => res.json())
        .then(data => {
            discountData = data || [];
            renderTable(discountData);
        })
        .catch(err => {
            console.error('Error fetching discount data:', err);
            if (document.getElementById('error-message')) {
                document.getElementById('error-message').style.display = 'block';
            }
        });

    // --------------- role ---------------
    async function checkRole() {
        try {
            const res = await fetch('/check-role');
            const data = await res.json();
            if (!data.loggedIn) {
                window.location.href = '/login.html';
                return;
            }
            window.isAdmin = data.role === 'Admin';
            if (!window.isAdmin) {
                // hide admin-only menu links
                document.querySelectorAll('.admin-only').forEach(link => link.style.display = 'none');
            }
        } catch (e) {
            console.error('Error checking role:', e);
            window.location.href = '/login.html';
        }
    }

    // --------------- render ---------------
    function renderTable(data) {
        if (!data || data.length === 0) {
            discountList.innerHTML = '<tr><td colspan="5">No discounts available.</td></tr>';
            const totalCell = document.getElementById('discount-total');
            if (totalCell) totalCell.textContent = '0';
            return;
        }

        discountList.innerHTML = '';
        let totalDiscount = 0;

        data.forEach((discount, index) => {
            const formattedDate = formatDate(discount.date);
            const amount = Number(discount.discount_amount || 0);
            totalDiscount += amount;

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', discount.id);

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${formattedDate}</td>
                <td>${discount.buyer_name}</td>
                <td>
                    <span class="discount-display">${formatNumberWithCommas(amount)}</span>
                    <input class="discount-input" type="number" value="${amount}" style="display:none;" />
                </td>
                <td class="action-cell">
                    <button class="edit-btn" data-id="${discount.id}">Edit</button>
                    <button class="delete-btn" data-id="${discount.id}">Delete</button>
                </td>
            `;
            discountList.appendChild(tr);
        });

        // update footer total
        const totalCell = document.getElementById('discount-total');
        if (totalCell) {
            totalCell.textContent = formatNumberWithCommas(totalDiscount);
        }

        // bind edit/delete
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', handleEditDiscount);
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteDiscount);
        });

        // hide action col for non-admin
        if (window.isAdmin === false) {
            if (actionHeader) actionHeader.style.display = 'none';
            document.querySelectorAll('#discount-table tbody tr').forEach(tr => {
                const td = tr.querySelector('.action-cell');
                if (td) td.style.display = 'none';
            });
            // also hide action col in footer
            const footerRow = document.querySelector('#discount-table tfoot tr');
            if (footerRow && footerRow.children[4]) {
                footerRow.children[4].style.display = 'none';
            }
        } else {
            if (actionHeader) actionHeader.style.display = '';
        }
    }

    // --------------- helpers ---------------
    function formatNumberWithCommas(n) {
        return Number(n).toLocaleString('en-US');
    }

    function formatDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // --------------- edit ---------------
    function handleEditDiscount(e) {
        const discountId   = e.target.dataset.id;
        const row          = e.target.closest('tr');
        const input        = row.querySelector('.discount-input');
        const displaySpan  = row.querySelector('.discount-display');

        input.style.display = 'inline';
        displaySpan.style.display = 'none';
        input.focus();

        input.addEventListener('blur', function onBlur() {
            input.removeEventListener('blur', onBlur);

            const newVal = Number(input.value);
            const oldVal = Number(displaySpan.textContent.replace(/,/g, ''));

            if (Number.isNaN(newVal) || newVal < 0) {
                input.value = oldVal;
                input.style.display = 'none';
                displaySpan.style.display = 'inline';
                return;
            }

            if (newVal === oldVal) {
                input.style.display = 'none';
                displaySpan.style.display = 'inline';
                return;
            }

            fetch(`/discounts/edit/${discountId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discount_amount: newVal })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        // update local
                        const item = discountData.find(d => d.id == discountId);
                        if (item) item.discount_amount = newVal;
                        renderTable(discountData);
                        alert('Discount updated successfully');
                    } else {
                        alert('Failed to update discount');
                        renderTable(discountData);
                    }
                })
                .catch(err => {
                    console.error('Error updating discount:', err);
                    alert('Failed to update discount');
                });
        });
    }

    // --------------- delete ---------------
    function handleDeleteDiscount(e) {
        const discountId = e.target.dataset.id;
        if (!confirm('Are you sure you want to delete this discount?')) return;

        fetch(`/discounts/delete/${discountId}`, {
            method: 'DELETE'
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // refetch or remove from local
                    discountData = discountData.filter(d => d.id != discountId);
                    renderTable(discountData);
                    alert('Discount deleted successfully');
                } else {
                    alert('Failed to delete discount');
                }
            })
            .catch(err => {
                console.error('Error deleting discount:', err);
                alert('Failed to delete discount');
            });
    }

    // --------------- search ---------------
    buyerSearchBox.addEventListener('input', function () {
        const q = buyerSearchBox.value.toLowerCase();
        const filtered = discountData.filter(d => d.buyer_name.toLowerCase().includes(q));
        renderTable(filtered);
    });

    // --------------- export excel ---------------
    exportExcelButton.addEventListener('click', function () {
        const table = document.getElementById('discount-table');
        const wb = XLSX.utils.table_to_book(table, { sheet: 'Discount List' });
        XLSX.writeFile(wb, 'Discount_List.xlsx');
    });

    // --------------- export pdf ---------------
    exportPdfButton.addEventListener('click', function () {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-GB').replace(/\//g, '-');
        let formattedTime = now.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: true
        }).replace(/[:\s]/g, '-').toUpperCase();

        const fileName = `Discount_List_${formattedDate}_${formattedTime}.pdf`;
        generatePDF(doc, formattedDate, fileName);
    });

    // the clean PDF generator
    function generatePDF(doc, formattedDate, fileName) {
        const pageWidth       = doc.internal.pageSize.width;
        const pageHeight      = doc.internal.pageSize.height;
        const headerBarHeight = 18;
        const startY          = headerBarHeight + 10;

        const watermarkImg = new Image();
        watermarkImg.src = '/public/watermark.png';

        watermarkImg.onload = function () {
            // build body rows and total from current DOM
            const tableBodyRows = [];
            let pdfTotal = 0;

            const rows = document.querySelectorAll('#discount-list tr');
            rows.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 4) {
                    const id    = tds[0].innerText.trim();
                    const date  = tds[1].innerText.trim();
                    const buyer = tds[2].innerText.trim();
                    const amtTxt = tds[3].innerText.trim();
                    const amtNum = Number(amtTxt.replace(/,/g, '')) || 0;
                    pdfTotal += amtNum;

                    tableBodyRows.push([id, date, buyer, amtTxt]);
                }
            });

            // footer for table (only on last page)
            const foot = [[
                { content: '', styles: { fillColor: [220,220,220] } },
                { content: '', styles: { fillColor: [220,220,220] } },
                { content: 'Total', styles: { halign: 'right', fontStyle: 'bold', fillColor: [220,220,220] } },
                formatNumberWithCommas(pdfTotal)
            ]];

            function addHeaderAndWatermark(pageNumber) {
                // watermark
                doc.setGState(new doc.GState({ opacity: 0.2 }));
                const wx = pageWidth / 4;
                const wy = pageHeight / 3;
                const ww = pageWidth / 2;
                const wh = pageHeight / 4;
                doc.addImage(watermarkImg, 'PNG', wx, wy, ww, wh);
                doc.setGState(new doc.GState({ opacity: 1 }));

                // header
                doc.setFillColor(49, 178, 230);
                doc.rect(0, 0, pageWidth, headerBarHeight, 'F');
                try {
                    doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
                } catch (e) {}
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('Discount List', pageWidth - 50, 11);

                // date on first page
                if (pageNumber === 1) {
                    const label = 'Date:';
                    const labelW = doc.getTextWidth(label);
                    const x = pageWidth - labelW - 40;
                    doc.setFontSize(9);
                    doc.setTextColor(0,0,0);
                    doc.setFont('helvetica', 'bold');
                    doc.text(label, x, 25);
                    doc.setFont('helvetica', 'normal');
                    doc.text(formattedDate, x + labelW + 5, 25);
                }
            }

            doc.autoTable({
                head: [['ID', 'Date', 'Buyer Name', 'Discount Amount']],
                body: tableBodyRows,
                foot: foot,
                showFoot: 'lastPage',
                theme: 'grid',
                startY: startY,
                margin: { top: 20, bottom: 40, horizontal: 10 },
                headStyles: {
                    fillColor: [0, 0, 0],
                    textColor: [255, 255, 255],
                    fontSize: 8,
                    fontStyle: 'bold',
                },
                bodyStyles: {
                    fontSize: 8,
                    textColor: [0, 0, 0],
                },
                footStyles: {
                    fontSize: 8,
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    fillColor: [220, 220, 220],
                },
                pageBreak: 'auto',
                showHead: 'everyPage',
                didDrawPage: function (data) {
                    addHeaderAndWatermark(data.pageNumber);
                }
            });

            // after table is done, add footer ONLY on last page
            const totalPages = doc.internal.getNumberOfPages();
            doc.setPage(totalPages);

            const line1 = 'Thank You For Your Business';
            const line2 = 'Generated by bYTE Ltd.';
            const line3 = 'For inquiries, contact support@lsgroup.com.bd';

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(line1, (pageWidth - doc.getTextWidth(line1)) / 2, pageHeight - 30);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(line2, (pageWidth - doc.getTextWidth(line2)) / 2, pageHeight - 20);
            doc.text(line3, (pageWidth - doc.getTextWidth(line3)) / 2, pageHeight - 15);

            doc.save(fileName);
        };

        watermarkImg.onerror = function () {
            console.error('Error loading watermark image.');
        };
    }

    // --------------- dropdown ---------------
    const dropdownButton = document.querySelector('.dropbtn');
    const dropdownContent = document.querySelector('.dropdown-content');
    if (dropdownButton && dropdownContent) {
        dropdownButton.addEventListener('click', function (e) {
            e.stopPropagation();
            dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
        });
        document.addEventListener('click', function () {
            dropdownContent.style.display = 'none';
        });
    }

    // --------------- logout ---------------
    document.getElementById('logout-btn')?.addEventListener('click', function (e) {
        e.preventDefault();
        fetch('/logout', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login.html';
                } else {
                    alert('Logout failed.');
                }
            })
            .catch(err => {
                console.error('Logout error:', err);
                alert('Something went wrong during logout.');
            });
    });
});
