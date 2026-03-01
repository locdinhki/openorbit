// ============================================================================
// Invoice Generator — Creates PDF invoices
// ============================================================================

import type { InvoiceRow } from '../db/invoices-repo'
import type { InvoiceItemRow } from '../db/invoice-items-repo'
import type { InvoiceTemplateRow } from '../db/templates-repo'

export interface InvoiceData {
  invoice: InvoiceRow
  items: InvoiceItemRow[]
  template?: InvoiceTemplateRow | null
  companyInfo: {
    name?: string
    email?: string
    address?: string
  }
}

export class InvoiceGenerator {
  generateHTML(data: InvoiceData): string {
    const { invoice, items, template, companyInfo } = data
    const primaryColor = template?.primary_color ?? '#4F46E5'

    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount)
    }

    const formatDate = (dateStr: string | null): string => {
      if (!dateStr) return 'N/A'
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const itemRows = items
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.amount)}</td>
        </tr>
      `
      )
      .join('')

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .logo img {
      max-height: 60px;
    }
    .invoice-title {
      font-size: 32px;
      font-weight: bold;
      color: ${primaryColor};
    }
    .invoice-number {
      color: #6b7280;
      font-size: 14px;
    }
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .address-block {
      flex: 1;
    }
    .address-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background: ${primaryColor};
      color: white;
      padding: 12px;
      text-align: left;
    }
    .items-table th:last-child,
    .items-table th:nth-child(2),
    .items-table th:nth-child(3) {
      text-align: right;
    }
    .totals {
      text-align: right;
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
    }
    .total-label {
      width: 120px;
      text-align: left;
      color: #6b7280;
    }
    .total-value {
      width: 120px;
      text-align: right;
    }
    .grand-total {
      font-size: 20px;
      font-weight: bold;
      color: ${primaryColor};
      border-top: 2px solid ${primaryColor};
      padding-top: 8px;
    }
    .payment-link {
      margin-top: 40px;
      padding: 20px;
      background: #f3f4f6;
      border-radius: 8px;
      text-align: center;
    }
    .payment-link a {
      display: inline-block;
      padding: 12px 24px;
      background: ${primaryColor};
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
    }
    .notes {
      margin-top: 40px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .footer {
      margin-top: 60px;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  ${template?.header_text ? `<div class="header-text">${template.header_text}</div>` : ''}

  <div class="header">
    <div class="logo">
      ${template?.logo_url ? `<img src="${template.logo_url}" alt="Logo">` : `<div style="font-size: 24px; font-weight: bold;">${companyInfo.name || 'Your Company'}</div>`}
    </div>
    <div style="text-align: right;">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-number">${invoice.invoice_number}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="address-label">From</div>
      <div><strong>${companyInfo.name || 'Your Company'}</strong></div>
      ${companyInfo.email ? `<div>${companyInfo.email}</div>` : ''}
      ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
    </div>
    <div class="address-block">
      <div class="address-label">Bill To</div>
      <div><strong>${invoice.customer_name}</strong></div>
      <div>${invoice.customer_email}</div>
      ${invoice.customer_address ? `<div>${invoice.customer_address}</div>` : ''}
      ${invoice.customer_phone ? `<div>${invoice.customer_phone}</div>` : ''}
    </div>
    <div class="address-block">
      <div class="address-label">Invoice Date</div>
      <div>${formatDate(invoice.created_at)}</div>
      <div class="address-label" style="margin-top: 12px;">Due Date</div>
      <div>${formatDate(invoice.due_date)}</div>
      <div class="address-label" style="margin-top: 12px;">Status</div>
      <div style="text-transform: uppercase; font-weight: 500; color: ${
        invoice.status === 'paid' ? '#10b981' : invoice.status === 'overdue' ? '#ef4444' : '#6b7280'
      };">${invoice.status}</div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <div class="total-label">Subtotal</div>
      <div class="total-value">${formatCurrency(invoice.subtotal)}</div>
    </div>
    ${
      invoice.tax_rate > 0
        ? `
    <div class="total-row">
      <div class="total-label">Tax (${invoice.tax_rate}%)</div>
      <div class="total-value">${formatCurrency(invoice.tax_amount)}</div>
    </div>
    `
        : ''
    }
    <div class="total-row grand-total">
      <div class="total-label">Total</div>
      <div class="total-value">${formatCurrency(invoice.total)}</div>
    </div>
    ${
      invoice.amount_paid > 0
        ? `
    <div class="total-row">
      <div class="total-label">Paid</div>
      <div class="total-value">-${formatCurrency(invoice.amount_paid)}</div>
    </div>
    <div class="total-row" style="font-weight: bold;">
      <div class="total-label">Balance Due</div>
      <div class="total-value">${formatCurrency(invoice.total - invoice.amount_paid)}</div>
    </div>
    `
        : ''
    }
  </div>

  ${
    invoice.stripe_payment_link_url && invoice.status !== 'paid'
      ? `
  <div class="payment-link">
    <p>Pay this invoice online:</p>
    <a href="${invoice.stripe_payment_link_url}">Pay Now</a>
  </div>
  `
      : ''
  }

  ${
    invoice.notes
      ? `
  <div class="notes">
    <strong>Notes</strong>
    <p>${invoice.notes}</p>
  </div>
  `
      : ''
  }

  <div class="footer">
    ${template?.footer_text || 'Thank you for your business!'}
  </div>
</body>
</html>
`
  }
}
