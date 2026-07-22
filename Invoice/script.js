document.querySelectorAll('.auto-grow').forEach(ta => {
    const resize = () => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    };

    ta.addEventListener('input', resize);
    resize();
});

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();

    // Invoice number: yyMM01
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');

    document.getElementById('invoice_no').value = `${yy}${mm}01`;

    // Today's date for <input type="date">
    document.getElementById('invoice_date').value =
        now.toISOString().split('T')[0];
    document.getElementById('invoice_date_print').textContent =
        now.toLocaleDateString('en-AU');
});

function updateTotals() {
    let grandTotal = 0;

    document.querySelectorAll('#itemRows tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.qtyField')?.value) || 0;
        const rate = parseFloat(row.querySelector('.rateField')?.value) || 0;

        const total = qty * rate;

        row.querySelector('.totalField').value =
            total ? total.toFixed(2) : '';

        grandTotal += total;
    });

    document.getElementById('grand_total').value =
        grandTotal ? grandTotal.toFixed(2) : '';
}

document.addEventListener('blur', e => {
    if (e.target.classList.contains('rateField')) {
        const value = parseFloat(e.target.value);

        if (!isNaN(value)) {
            e.target.value = value.toFixed(2);
        }
    }
}, true);

function updateDocumentTitle() {
    const invoiceNo = document.getElementById('invoice_no').value;
    const customer = document.getElementById('cust_company').value;

    document.title = `Invoice ${invoiceNo} - ${customer}`;
}

function updateInvoiceDatePrint() {
    const invoiceDate = new Date(document.getElementById('invoice_date').value);
    document.getElementById('invoice_date_print').textContent =
        invoiceDate.toLocaleDateString('en-AU');
}

document.getElementById('invoice_date')
    .addEventListener('input', updateInvoiceDatePrint);

document.getElementById('invoice_no')
    .addEventListener('input', updateDocumentTitle);

document.getElementById('cust_company')
    .addEventListener('input', updateDocumentTitle);

function updateButtons() {
    // Remove existing buttons
    document.querySelectorAll('.addRowBtn, .removeRowBtn')
        .forEach(btn => btn.remove());

    const rows = document.querySelectorAll('#itemRows tr');

    // Plus button on last row
    const lastRow = rows[rows.length - 1];
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'rowBtn addRowBtn';
    addBtn.textContent = '+';

    lastRow.appendChild(addBtn);

    // Minus button on second-last row (if applicable)
    if (rows.length > 1) {
        const secondLastRow = rows[rows.length - 2];

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'rowBtn removeRowBtn';
        removeBtn.textContent = '−';

        secondLastRow.appendChild(removeBtn);
    }
}

function addRow() {
    const template = document.querySelector('#itemRows tr');
    const newRow = template.cloneNode(true);

    newRow.querySelector('.qtyField').value = '1';
    newRow.querySelector('.descField').value = '';
    newRow.querySelector('.rateField').value = '';
    newRow.querySelector('.totalField').value = '';

    document.getElementById('itemRows').appendChild(newRow);

    updateButtons();
    updateTotals();
}

function removeRow(row) {
    row.remove();

    updateButtons();
    updateTotals();
}

document.addEventListener('input', e => {
    if (
        e.target.classList.contains('qtyField') ||
        e.target.classList.contains('rateField')
    ) {
        updateTotals();
    }
});

document.addEventListener('click', e => {
    if (e.target.classList.contains('addRowBtn')) {
        addRow();
    }

    if (e.target.classList.contains('removeRowBtn')) {
        removeRow(e.target.closest('tr'));
    }
});

// Initial setup
updateTotals();
updateButtons();
