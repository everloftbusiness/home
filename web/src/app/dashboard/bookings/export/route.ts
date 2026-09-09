import { listBookings, requireRegisterAccess } from '@/features/bookings';
import ExcelJS from 'exceljs';

export async function GET(request: Request) {
  try {
    await requireRegisterAccess();
  } catch {
    return new Response('Access denied', { status: 403 });
  }

  try {
    const filters = Object.fromEntries(new URL(request.url).searchParams);
    const { rows, total } = await listBookings(filters, true);

    if (total > 1000) {
      return new Response('More than 1,000 records match. Narrow your filters before exporting.', { status: 422 });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Everloft Booking Register');

    // Column Widths matching D:\Untitled spreadsheet.xlsx
    worksheet.columns = [
      { key: 'pad', width: 4 },
      { key: 'date', width: 14 },
      { key: 'guest', width: 28 },
      { key: 'room', width: 12 },
      { key: 'site', width: 14 },
      { key: 'guestBase', width: 16 },
      { key: 'days', width: 14 },
      { key: 'guestTax', width: 20 },
      { key: 'guestService', width: 26 },
      { key: 'guestTotal', width: 18 },
      { key: 'hostBase', width: 16 },
      { key: 'rateAdj', width: 18 },
      { key: 'hostFee', width: 22 },
      { key: 'hostTax', width: 16 },
      { key: 'addIncome', width: 18 },
      { key: 'hostTotal', width: 18 },
      { key: 'contact', width: 18 },
      { key: 'bank', width: 24 },
      { key: 'creditedDate', width: 24 },
      { key: 'note', width: 32 },
    ];

    // Rows 1 & 2: Padding
    worksheet.addRow([]);
    worksheet.addRow([]);

    // Row 3: Tier 1 Group Headers
    const row3 = worksheet.getRow(3);
    row3.getCell(6).value = 'Guest Paid';
    row3.getCell(11).value = 'Host payout';

    worksheet.mergeCells('F3:J3');
    worksheet.mergeCells('K3:P3');

    // Style Row 3 Header Cells matching D:\Untitled spreadsheet.xlsx
    const guestPaidCell = row3.getCell(6);
    guestPaidCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFEFEF' }, // Light Grey #EFEFEF
    };
    guestPaidCell.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
    guestPaidCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const hostPayoutCell = row3.getCell(11);
    hostPayoutCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFCE5CD' }, // Soft Peach #FCE5CD
    };
    hostPayoutCell.font = { bold: true, size: 11, color: { argb: 'FF9A3412' } };
    hostPayoutCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: Padding
    worksheet.addRow([]);

    // Row 5: Column Headers matching D:\Untitled spreadsheet.xlsx
    const headerRow = worksheet.getRow(5);
    const headers = [
      '',
      'Date',
      'Guest name',
      'Room',
      'Site',
      'Base fair',
      'Number of days',
      'Taxes / Percentage',
      'Services charge / Percentage',
      'Total Amount',
      'Base fair',
      'rate adjustment',
      'Service fee / Percentage',
      'Tax / Percentage',
      'Additional Income',
      'Total',
      'Contact',
      'Amount Credited',
      'Credited Date',
      'Note',
    ];

    headers.forEach((h, idx) => {
      if (idx > 0) {
        const cell = headerRow.getCell(idx);
        cell.value = h;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E293B' }, // Slate Dark Fill #1E293B
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { horizontal: idx >= 6 && idx <= 16 ? 'right' : 'left', vertical: 'middle' };
      }
    });

    // Populate rows with real booking data
    rows.forEach((r, rIdx) => {
      const guestTot = r.guest_total || 0;
      const guestBase = Math.round((guestTot / 1.18) * 100) / 100;
      const guestTax = Math.round((guestTot - guestBase) * 100) / 100;
      const hostTot = r.host_total || 0;
      const hostBase = hostTot;

      const rowValues = [
        '',
        r.check_in_date || '',
        r.guest_name || 'Guest',
        r.unit_label || '405',
        r.source || 'Airbnb',
        guestBase,
        r.nights || 1,
        guestTax,
        0, // Service charge
        guestTot,
        hostBase,
        0, // rate adjustment
        0, // Service fee
        0, // Tax
        0, // Additional income
        hostTot,
        r.phone || '',
        r.host_received > 0 ? `Credited ₹${r.host_received}` : 'EVERLOFT - KGB',
        r.check_out_date || '',
        `Ref: ${r.reservation_code}${r.notes ? ` - ${r.notes}` : ''}`,
      ];

      const row = worksheet.getRow(6 + rIdx);
      rowValues.forEach((val, cIdx) => {
        if (cIdx > 0) {
          const cell = row.getCell(cIdx);
          cell.value = val;
          if (rIdx % 2 === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' }, // Zebra striping #F8FAFC
            };
          }
        }
      });
    });

    // DATA VALIDATION (Interactive Excel Dropdowns)
    const maxRow = Math.max(100, rows.length + 10);
    for (let r = 6; r <= maxRow; r++) {
      worksheet.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"306, 403, 405, 406"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Room',
        error: 'Please select a valid room unit.',
      };

      worksheet.getCell(`E${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Airbnb, Agoda, Booking.com, Direct Booking, MakeMyTrip, Goibibo"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Channel',
        error: 'Please select a valid channel/site.',
      };

      worksheet.getCell(`R${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Akhil, Nikhil, Jithin, EVERLOFT - KGB, EVERLOFT - YES Bank, EVERLOFT - HDFC"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Bank Destination',
        error: 'Please select a valid bank account or manager.',
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="everloft_bookings_ledger.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Export Excel failed:', err);
    return new Response('Export failed. Please try again.', { status: 500 });
  }
}
