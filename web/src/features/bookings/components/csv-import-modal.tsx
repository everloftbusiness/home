'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Download,
  ArrowRight,
  Plus,
  Trash2,
  Zap,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  parseGoogleSheetCsv,
  detectHeaderColumns,
  SYSTEM_MAPPING_FIELDS,
  getCombinedSystemFields,
  type DynamicFieldDefinition,
  type ParsedImportRow,
} from '../utils/csv-parser';
import { importBookingsAction } from '../actions/import.actions';
import { type PropertyOption } from '../types/booking.types';
import { money } from '../utils/money';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export function CsvImportModal({
  properties,
  onImportComplete,
}: {
  properties: PropertyOption[];
  onImportComplete?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id || '');
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');
  
  // Dynamic Column Mapping State
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [customMappings, setCustomMappings] = useState<Record<number, string>>({});
  const [isMappingOpen, setIsMappingOpen] = useState(false);

  // Dynamic Custom System Fields State
  const [dynamicFields, setDynamicFields] = useState<DynamicFieldDefinition[]>([]);
  const [isAddDynamicOpen, setIsAddDynamicOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldCategory, setNewFieldCategory] = useState('Custom Details');
  const [newFieldDataType, setNewFieldDataType] = useState<'text' | 'number' | 'date'>('text');

  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load saved dynamic fields from localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('everloft_dynamic_system_fields');
        if (saved) {
          setDynamicFields(JSON.parse(saved));
        }
      }
    } catch (err) {
      console.error('Failed to load dynamic system fields:', err);
    }
  }, []);

  function saveDynamicFields(updatedFields: DynamicFieldDefinition[]) {
    setDynamicFields(updatedFields);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('everloft_dynamic_system_fields', JSON.stringify(updatedFields));
      }
    } catch (err) {
      console.error('Failed to save dynamic system fields:', err);
    }
  }

  function handleAddDynamicField(
    labelName: string,
    category = 'Custom Details',
    dataType: 'text' | 'number' | 'date' = 'text',
    colIdxToMap?: number
  ) {
    if (!labelName.trim()) {
      toast.error('Field name cannot be empty');
      return;
    }

    const cleanKey = `custom_${labelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newDef: DynamicFieldDefinition = {
      key: cleanKey,
      label: labelName.trim(),
      category,
      dataType,
      isDynamic: true,
    };

    const updatedFields = [...dynamicFields.filter((f) => f.key !== cleanKey), newDef];
    saveDynamicFields(updatedFields);

    let updatedMappings = customMappings;
    if (colIdxToMap !== undefined) {
      updatedMappings = { ...customMappings, [colIdxToMap]: cleanKey };
      setCustomMappings(updatedMappings);
      toast.success(`Registered '${labelName}' as dynamic field & mapped Column ${colIdxToMap}!`);
    } else {
      toast.success(`Dynamic system field '${labelName}' registered!`);
    }

    if (csvText) {
      const parsed = parseGoogleSheetCsv(csvText, updatedMappings, updatedFields);
      setParsedRows(parsed);
    }

    setNewFieldName('');
    setIsAddDynamicOpen(false);
  }

  function handleDeleteDynamicField(keyToDelete: string) {
    const updatedFields = dynamicFields.filter((f) => f.key !== keyToDelete);
    saveDynamicFields(updatedFields);

    // Clean up mapping
    const updatedMappings = { ...customMappings };
    Object.entries(updatedMappings).forEach(([colStr, mappedKey]) => {
      if (mappedKey === keyToDelete) {
        delete updatedMappings[parseInt(colStr, 10)];
      }
    });
    setCustomMappings(updatedMappings);

    if (csvText) {
      const parsed = parseGoogleSheetCsv(csvText, updatedMappings, updatedFields);
      setParsedRows(parsed);
    }
    toast.info('Dynamic field removed.');
  }

  function processContent(text: string, activeDynamicFields = dynamicFields) {
    setCsvText(text);
    const detected = detectHeaderColumns(text);
    setDetectedHeaders(detected.headers);

    let activeMappings = detected.suggestedMappings;
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('everloft_custom_excel_mappings');
        if (saved) {
          const parsed = JSON.parse(saved);
          activeMappings = { ...detected.suggestedMappings, ...parsed };
        }
      }
    } catch (err) {
      console.error('Failed to load saved column mappings:', err);
    }

    setCustomMappings(activeMappings);
    const parsed = parseGoogleSheetCsv(text, activeMappings, activeDynamicFields);
    setParsedRows(parsed);
  }

  function handleFileRead(file: File) {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const text = XLSX.utils.sheet_to_csv(worksheet);
          processContent(text);
        } catch (err) {
          setImportError('Failed to read Excel file. Please try exporting as CSV.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          processContent(text);
        }
      };
      reader.readAsText(file);
    }
  }

  function handleTextChange(val: string) {
    if (val.trim()) {
      processContent(val);
    } else {
      setCsvText('');
      setParsedRows([]);
      setDetectedHeaders([]);
      setCustomMappings({});
    }
  }

  function handleMappingChange(colIdx: number, newFieldKey: string) {
    const updated = { ...customMappings, [colIdx]: newFieldKey };
    setCustomMappings(updated);
    if (csvText) {
      const parsed = parseGoogleSheetCsv(csvText, updated, dynamicFields);
      setParsedRows(parsed);
    }
  }

  function saveMappingPreset() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('everloft_custom_excel_mappings', JSON.stringify(customMappings));
        toast.success('Column mapping rule saved! Future uploads will auto-apply this mapping.');
      }
    } catch (e) {
      toast.error('Failed to save mapping rule.');
    }
  }

  async function downloadSampleExcel() {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Everloft Booking Ledger');

      // Set column widths matching D:\Untitled spreadsheet.xlsx
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

      // Rows 1 & 2: Blank padding
      worksheet.addRow([]);
      worksheet.addRow([]);

      // Row 3: Tier 1 Group Headers
      const row3 = worksheet.getRow(3);
      row3.getCell(6).value = 'Guest Paid';
      row3.getCell(11).value = 'Host payout';

      // Merge cells for Guest Paid (F3:J3) & Host payout (K3:P3)
      worksheet.mergeCells('F3:J3');
      worksheet.mergeCells('K3:P3');

      // Style Row 3 Header Cells
      const guestPaidCell = row3.getCell(6);
      guestPaidCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' }, // Light grey #EFEFEF
      };
      guestPaidCell.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
      guestPaidCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const hostPayoutCell = row3.getCell(11);
      hostPayoutCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCE5CD' }, // Soft peach/orange #FCE5CD
      };
      hostPayoutCell.font = { bold: true, size: 11, color: { argb: 'FF9A3412' } };
      hostPayoutCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Row 4: Blank padding
      worksheet.addRow([]);

      // Row 5: Tier 2 Column Headers matching D:\Untitled spreadsheet.xlsx
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
            fgColor: { argb: 'FF1E293B' }, // Slate dark fill #1E293B
          };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.alignment = { horizontal: idx >= 6 && idx <= 16 ? 'right' : 'left', vertical: 'middle' };
        }
      });

      // Sample Data Rows matching D:\Untitled spreadsheet.xlsx
      const sampleData = [
        ['', '2-Jun-2026', 'Midde Panduranga', '405', 'Airbnb', 2080, 1, 104, 293.65, 2477.65, 2600, 520, 62.4, 2.08, 0, 2015.52, '8639523868', 'EVERLOFT - KGB', 'Credited 3th June', 'Credited 3th June'],
        ['', '3-Jun-2026', 'Sachinkumaar', '306', 'Airbnb', 2080, 1, 104, 293.65, 2477.65, 2600, 520, 62.4, 2.08, 0, 2015.52, '', 'EVERLOFT - KGB', 'Credited 6th June', 'Credited 6th June Kgb Combine 6k'],
        ['', '4-Jun-2026', 'Muhammed Ashique A T', '405', 'Airbnb', 4974.36, 2, 208.8, 589.56, 4974.36, 5220, 1044, 125.28, 4.18, 1500, 5546.54, '', 'EVERLOFT - KGB', 'Credited 6th June', '4046.54 total'],
        ['', '5-Jun-2026', 'Noori Sheriff', '306', 'Airbnb', 2487.18, 1, 104.4, 294.78, 2487.18, 2610, 522, 62.64, 2.09, 0, 2023.27, '', 'EVERLOFT - KGB', 'Credited 6th June', ''],
        ['', '6-Jun-2026', 'Muhammed Fasil Pm', '306', 'Airbnb', 2288, 1, 114.4, 323.01, 2725.41, 2860, 572, 68.64, 2.29, 0, 2217.07, '', 'EVERLOFT - KGB', 'Credited 7th June', ''],
        ['', '6-Jun-2026', 'Basavaraj Ramanagouda Yalawar', '406', 'Airbnb', 2649.18, 1, 111.2, 313.98, 2649.18, 2780, 556, 66.72, 2.22, 0, 2155.06, '', 'EVERLOFT - KGB', 'Credited 7th June', ''],
        ['', '7-Jun-2026', 'Devarasetty', '406', 'Airbnb', 4160, 2, 208, 587.3, 4955.3, 5200, 1040, 124.8, 4.16, 0, 4031.04, '', 'EVERLOFT - KGB', 'Credited 8th June', ''],
        ['', '9-Jun-2026', 'Unknown Direct Booking', '406', 'DB', 4400, 2, 0, 0, 4400, 4400, 0, 0, 0, 0, 4400, '91 95441 65972', 'Akhil', 'Credited 9th June', 'Direct guest booking'],
      ];

      sampleData.forEach((rowValues, rIdx) => {
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

      // INTERACTIVE EXCEL DROPDOWNS (DATA VALIDATION)
      for (let r = 6; r <= 100; r++) {
        // Room Dropdown (Col D)
        worksheet.getCell(`D${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"306, 403, 405, 406"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Room',
          error: 'Please select a valid room unit from dropdown.',
        };

        // Site / Channel Dropdown (Col E)
        worksheet.getCell(`E${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Airbnb, Agoda, Booking.com, Direct Booking, MakeMyTrip, Goibibo"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Channel',
          error: 'Please select a valid booking site/channel.',
        };

        // Amount Credited / Bank Dropdown (Col R)
        worksheet.getCell(`R${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Akhil, Nikhil, Jithin, EVERLOFT - KGB, EVERLOFT - YES Bank, EVERLOFT - HDFC"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Payout Destination',
          error: 'Please select a valid bank account or manager from dropdown.',
        };
      }

      // Generate binary buffer and download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'everloft_booking_import_sample.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Downloaded styled sample Excel register with colors & dropdowns!');
    } catch (err) {
      console.error('Failed to generate Excel file:', err);
      toast.error('Failed to download Excel file. Using CSV fallback.');
      downloadSampleCsv();
    }
  }

  function downloadSampleCsv() {
    const sample = `Date,Guest name,Room,Site,Base fair,Number of days,Taxes / Percentage,Services charge / Percentage,Total Amount,Base fair,rate adjustment,Service fee / Percentage,Tax / Percentage,Additional Income,Total,Contact,Amount Credited,Credited Date,Note
2-Jun-2026,Midde Panduranga,405,Airbnb,2080.00,1,104,293.65,2477.65,2600,520,62.4,2.08,0,2015.52,8639523868,EVERLOFT - KGB,Credited 3th June,Credited 3th June
3-Jun-2026,Sachinkumaar,306,Airbnb,2080.00,1,104,293.65,2477.65,2600,520,62.4,2.08,0,2015.52,,EVERLOFT - KGB,Credited 6th June,Credited 6th June Kgb Combine 6k
4-Jun-2026,Muhammed Ashique A T,405,Airbnb,4974.36,2,208.8,589.56,4974.36,5220,1044,125.28,4.18,1500,5546.54,,EVERLOFT - KGB,Credited 6th June,4046.54 total`;

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'everloft_booking_import_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleImportSubmit() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setImportError('No valid rows found to import.');
      return;
    }

    setImportError(null);
    startTransition(async () => {
      try {
        const res = await importBookingsAction(validRows, selectedPropertyId);
        if (res.success) {
          setImportSuccessMessage(`Successfully imported ${res.count} booking records!`);
          setTimeout(() => {
            setIsOpen(false);
            setImportSuccessMessage(null);
            setCsvText('');
            setParsedRows([]);
            if (onImportComplete) onImportComplete();
          }, 1500);
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Import failed.');
      }
    });
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const totalGuestSum = parsedRows.filter((r) => r.isValid).reduce((sum, r) => sum + r.guestTotal, 0);
  const totalHostSum = parsedRows.filter((r) => r.isValid).reduce((sum, r) => sum + r.hostTotal, 0);

  const combinedFields = getCombinedSystemFields(dynamicFields);
  const activeMappedDynamicFields = dynamicFields.filter((df) =>
    Object.values(customMappings).includes(df.key)
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-lg border-border bg-card text-xs font-medium hover:bg-muted shadow-xs"
        onClick={() => setIsOpen(true)}
      >
        <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        Import Excel / CSV
      </Button>

      {isOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in ${
            isFullScreen ? 'p-0' : 'p-4'
          }`}
        >
          <div
            className={`bg-card border border-border/80 shadow-2xl p-6 overflow-y-auto space-y-5 transition-all duration-200 ${
              isFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none'
                : 'w-full max-w-5xl max-h-[90vh] rounded-2xl animate-in zoom-in-95'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="h-3.5 w-3.5" /> Self-Serve Spreadsheet Importer
                  </span>
                  {isFullScreen && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Full Screen View
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 text-2xl font-bold text-foreground">
                  Import Google Sheet / Excel Register
                </h2>
                <p className="text-xs text-muted-foreground">
                  Upload accounting spreadsheets, map custom fields dynamically from the website, and reconcile tax & payout ledgers.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
                  onClick={() => setIsFullScreen(!isFullScreen)}
                >
                  {isFullScreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Dropzone & Property Select */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Upload CSV File or Drop Spreadsheet Export
                </label>
                <div className="relative border-2 border-dashed border-border/80 hover:border-emerald-500/60 rounded-xl p-5 text-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileRead(file);
                    }}
                  />
                  <Upload className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-400 mb-1" />
                  <p className="text-xs font-medium text-foreground">
                    Click to select `.csv` or `.xlsx` file or drag & drop here
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Supports Google Sheet exports, multi-tab Excel files, and custom CSV formats
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Default Target Property</label>
                  <select
                    className="mt-1.5 w-full h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-xs focus:ring-1 focus:ring-ring"
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="w-full h-8 text-xs justify-center font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-2xs"
                    onClick={downloadSampleExcel}
                  >
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Download Sample Excel (.xlsx)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="w-full h-7 text-[11px] justify-center text-muted-foreground hover:text-foreground"
                    onClick={downloadSampleCsv}
                  >
                    <Download className="mr-1.5 h-3 w-3" /> Download Sample CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Optional Paste CSV Text Box */}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                Or paste CSV spreadsheet text directly...
              </summary>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Paste CSV lines here..."
                className="mt-2 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs focus:ring-1 focus:ring-ring"
              />
            </details>

            {/* Dynamic Custom System Field Creator Bar */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/20 px-2 py-0.5 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30">
                  ✨ Dynamic Fields
                </span>
                <span className="text-muted-foreground">
                  {dynamicFields.length === 0
                    ? 'No custom website fields added yet.'
                    : `${dynamicFields.length} dynamic field(s) saved in website schema.`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-7 text-[11px] border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 font-semibold"
                  onClick={() => setIsAddDynamicOpen(!isAddDynamicOpen)}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Dynamic System Field
                </Button>
              </div>
            </div>

            {/* Add Dynamic Field Modal Form */}
            {isAddDynamicOpen && (
              <div className="rounded-xl border border-purple-500/40 bg-card p-4 text-xs space-y-3 animate-in fade-in shadow-md">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Create Custom Field on Website
                  </h4>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setIsAddDynamicOpen(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Field Label Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Airport Transfer Fee"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="mt-1 w-full h-8 rounded border border-input bg-background px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Category</label>
                    <select
                      value={newFieldCategory}
                      onChange={(e) => setNewFieldCategory(e.target.value)}
                      className="mt-1 w-full h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="Guest Particulars">Guest Particulars</option>
                      <option value="Stay Particulars">Stay Particulars</option>
                      <option value="Financials">Financials</option>
                      <option value="Custom Details">Custom Details</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Data Type</label>
                    <select
                      value={newFieldDataType}
                      onChange={(e) => setNewFieldDataType(e.target.value as 'text' | 'number' | 'date')}
                      className="mt-1 w-full h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="text">Text / String</option>
                      <option value="number">Number / Currency Amount</option>
                      <option value="date">Date (YYYY-MM-DD)</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-7 text-[11px]"
                    onClick={() => setIsAddDynamicOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="blue-accent"
                    size="xs"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() => handleAddDynamicField(newFieldName, newFieldCategory, newFieldDataType)}
                  >
                    Register Field
                  </Button>
                </div>
              </div>
            )}

            {/* List Registered Dynamic Fields Badges */}
            {dynamicFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground font-medium">Active Website Dynamic Schema:</span>
                {dynamicFields.map((df) => (
                  <span
                    key={df.key}
                    className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 font-mono text-purple-700 dark:text-purple-300 border border-purple-500/20"
                  >
                    ✨ {df.label}
                    <button
                      type="button"
                      className="hover:text-rose-500 ml-0.5"
                      title="Remove dynamic field"
                      onClick={() => handleDeleteDynamicField(df.key)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Interactive Dynamic Column Header Mapping Panel */}
            {detectedHeaders.length > 0 && (
              <details className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs" open={isMappingOpen}>
                <summary
                  className="cursor-pointer font-semibold text-foreground flex items-center justify-between select-none"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMappingOpen(!isMappingOpen);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                      ⚙️ Column Mapper
                    </span>
                    <span>Customize Excel Header ➔ Website Field Assignments ({detectedHeaders.length} Columns Detected)</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-7 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveMappingPreset();
                    }}
                  >
                    Save Mapping Preset Rule
                  </Button>
                </summary>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                  {detectedHeaders.map((headerText, colIdx) => {
                    const isMapped = customMappings[colIdx] && customMappings[colIdx] !== 'ignore';
                    const mappedKey = customMappings[colIdx];
                    const isDynamicMapped = dynamicFields.some((df) => df.key === mappedKey);

                    return (
                      <div
                        key={colIdx}
                        className={`flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 shadow-2xs transition-colors ${
                          isDynamicMapped
                            ? 'border-purple-500/40 bg-purple-500/5'
                            : isMapped
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-muted-foreground">Col {colIdx}:</span>
                          <span className="font-bold text-foreground truncate max-w-[140px]" title={headerText}>
                            "{headerText || `<Blank>`}"
                          </span>
                        </div>

                        <select
                          className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] font-medium focus:ring-1 focus:ring-ring"
                          value={customMappings[colIdx] || 'ignore'}
                          onChange={(e) => handleMappingChange(colIdx, e.target.value)}
                        >
                          <option value="ignore">— Ignore Column —</option>
                          <optgroup label="Default Website System Fields">
                            {SYSTEM_MAPPING_FIELDS.filter((f) => f.key !== 'ignore').map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                              </option>
                            ))}
                          </optgroup>
                          {dynamicFields.length > 0 && (
                            <optgroup label="✨ Custom Dynamic Website Fields">
                              {dynamicFields.map((f) => (
                                <option key={f.key} value={f.key}>
                                  ✨ {f.label} [Dynamic]
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>

                        {/* Status badge & Quick Add button */}
                        <div className="flex items-center justify-between text-[10px] pt-0.5">
                          {isDynamicMapped ? (
                            <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                              <Sparkles className="h-2.5 w-2.5" /> Dynamic Field Mapped
                            </span>
                          ) : isMapped ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Auto-Mapped
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Unmapped</span>
                          )}

                          {!isMapped && headerText.trim() && (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              className="h-5 text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 font-semibold px-1.5"
                              onClick={() => handleAddDynamicField(headerText, 'Custom Details', 'text', colIdx)}
                            >
                              <Zap className="mr-1 h-2.5 w-2.5" /> ⚡ Add Field
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {/* Reconciliation Preview Grid */}
            {parsedRows.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Reconciliation Preview ({validCount} valid rows)
                    </h3>
                    
                    {/* View Mode Toggle */}
                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs font-medium">
                      <button
                        type="button"
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          viewMode === 'full'
                            ? 'bg-card text-foreground font-semibold shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setViewMode('full')}
                      >
                        Full Excel Ledger ({18 + activeMappedDynamicFields.length} Columns)
                      </button>
                      <button
                        type="button"
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          viewMode === 'compact'
                            ? 'bg-card text-foreground font-semibold shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setViewMode('compact')}
                      >
                        Compact Summary
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span>
                      Guest Charges: <strong className="text-indigo-600 dark:text-indigo-400">{money(totalGuestSum, 'INR')}</strong>
                    </span>
                    <span>
                      Host Payouts: <strong className="text-emerald-600 dark:text-emerald-400">{money(totalHostSum, 'INR')}</strong>
                    </span>
                  </div>
                </div>

                {viewMode === 'full' ? (
                  /* FULL EXCEL LEDGER TABLE WITH DYNAMIC COLUMNS & DUAL-TIER HEADERS */
                  <div className="overflow-x-auto max-h-80 rounded-xl border bg-card shadow-inner">
                    <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                      <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur-xs border-b font-semibold text-[11px]">
                        {/* Tier 1 Header */}
                        <tr className="border-b border-border/80">
                          <th colSpan={2} className="px-3 py-1.5 bg-slate-500/10 text-slate-700 dark:text-slate-300 border-r text-center sticky left-0 z-30">
                            PARTICULARS
                          </th>
                          <th colSpan={4} className="px-3 py-1.5 bg-slate-500/10 text-slate-700 dark:text-slate-300 border-r text-center">
                            STAY PARTICULARS
                          </th>
                          <th colSpan={4} className="px-3 py-1.5 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-r text-center font-bold">
                            GUEST PAID LEDGER
                          </th>
                          <th colSpan={6} className="px-3 py-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-r text-center font-bold">
                            HOST PAYOUT LEDGER
                          </th>
                          {activeMappedDynamicFields.length > 0 && (
                            <th colSpan={activeMappedDynamicFields.length} className="px-3 py-1.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 border-r text-center font-bold">
                              ✨ DYNAMIC WEBSITE FIELDS
                            </th>
                          )}
                          <th colSpan={5} className="px-3 py-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-center">
                            SETTLEMENT & NOTES
                          </th>
                        </tr>
                        {/* Tier 2 Header */}
                        <tr className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider">
                          <th className="px-2 py-1.5 border-r text-center sticky left-0 z-30 bg-muted w-8">#</th>
                          <th className="px-3 py-1.5 border-r sticky left-8 z-30 bg-muted">Guest Name</th>
                          <th className="px-2.5 py-1.5 border-r">Date</th>
                          <th className="px-2.5 py-1.5 border-r">Room</th>
                          <th className="px-2.5 py-1.5 border-r">Site</th>
                          <th className="px-2 py-1.5 border-r text-center">Nights</th>

                          {/* Guest Paid */}
                          <th className="px-2.5 py-1.5 border-r text-right bg-indigo-500/5">Base Fair</th>
                          <th className="px-2.5 py-1.5 border-r text-right bg-indigo-500/5">Taxes (GST)</th>
                          <th className="px-2.5 py-1.5 border-r text-right bg-indigo-500/5">Service Fee</th>
                          <th className="px-3 py-1.5 border-r text-right bg-indigo-500/10 font-bold text-indigo-600 dark:text-indigo-400">Total Amount</th>

                          {/* Host Payout */}
                          <th className="px-2.5 py-1.5 border-r text-right bg-emerald-500/5">Host Base</th>
                          <th className="px-2.5 py-1.5 border-r text-right bg-emerald-500/5">Rate Adj</th>
                          <th className="px-2.5 py-1.5 border-r text-right bg-emerald-500/5">Service Fee</th>
                          <th className="px-2.5 py-1.5 border-r text-right bg-emerald-500/5">Host Tax</th>
                          <th className="px-2.5 py-1.5 border-r text-right bg-emerald-500/5">Add. Income</th>
                          <th className="px-3 py-1.5 border-r text-right bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">Host Total</th>

                          {/* Active Dynamic Mapped Fields */}
                          {activeMappedDynamicFields.map((df) => (
                            <th key={df.key} className="px-3 py-1.5 border-r font-bold text-purple-600 dark:text-purple-400 bg-purple-500/5">
                              ✨ {df.label}
                            </th>
                          ))}

                          {/* Settlement */}
                          <th className="px-2.5 py-1.5 border-r">Contact</th>
                          <th className="px-3 py-1.5 border-r">Amount Credited</th>
                          <th className="px-2.5 py-1.5 border-r">Credited Date</th>
                          <th className="px-3 py-1.5 border-r">Note</th>
                          <th className="px-2.5 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parsedRows.map((r, idx) => (
                          <tr key={idx} className={r.isValid ? 'hover:bg-muted/30' : 'bg-rose-500/5'}>
                            <td className="px-2 py-1.5 border-r text-muted-foreground text-center sticky left-0 z-10 bg-card">{r.rawLineIndex}</td>
                            <td className="px-3 py-1.5 border-r sticky left-8 z-10 bg-card">
                              <span className="font-semibold text-foreground">{r.guestName}</span>
                              {r.reconciliationNote && (
                                <span className="block text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                  ⚡ {r.reconciliationNote}
                                </span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 border-r font-mono text-[11px] text-muted-foreground">{r.checkInDate}</td>
                            <td className="px-2.5 py-1.5 border-r">
                              <span className="font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                {r.roomLabel || 'Whole Villa'}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 border-r">{r.source}</td>
                            <td className="px-2 py-1.5 border-r font-mono text-center">{r.nights}</td>

                            {/* Guest Ledger */}
                            <td className="px-2.5 py-1.5 border-r text-right font-mono">{money(r.guestBase, 'INR')}</td>
                            <td className="px-2.5 py-1.5 border-r text-right font-mono text-muted-foreground">{money(r.guestTaxes, 'INR')}</td>
                            <td className="px-2.5 py-1.5 border-r text-right font-mono text-muted-foreground">{money(r.guestServiceCharge, 'INR')}</td>
                            <td className="px-3 py-1.5 border-r text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/5">
                              {money(r.guestTotal, 'INR')}
                            </td>

                            {/* Host Ledger */}
                            <td className="px-2.5 py-1.5 border-r text-right font-mono">{money(r.hostBase, 'INR')}</td>
                            <td className="px-2.5 py-1.5 border-r text-right font-mono text-muted-foreground">{money(r.hostRateAdjustment, 'INR')}</td>
                            <td className="px-2.5 py-1.5 border-r text-right font-mono text-muted-foreground">{money(r.hostServiceFee, 'INR')}</td>
                            <td className="px-2.5 py-1.5 border-r text-right font-mono text-muted-foreground">{money(r.hostTaxes, 'INR')}</td>
                            <td className="px-2.5 py-1.5 border-r text-right font-mono text-muted-foreground">{money(r.hostAdditionalIncome, 'INR')}</td>
                            <td className="px-3 py-1.5 border-r text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                              {money(r.hostTotal, 'INR')}
                            </td>

                            {/* Dynamic Custom Fields Values */}
                            {activeMappedDynamicFields.map((df) => (
                              <td key={df.key} className="px-3 py-1.5 border-r font-mono text-[11px] bg-purple-500/5 font-medium text-purple-700 dark:text-purple-300">
                                {r.customFields?.[df.key] !== undefined ? String(r.customFields[df.key]) : '—'}
                              </td>
                            ))}

                            {/* Settlement */}
                            <td className="px-2.5 py-1.5 border-r font-mono text-[11px]">{r.contactPhone || '—'}</td>
                            <td className="px-3 py-1.5 border-r font-semibold text-emerald-600 dark:text-emerald-400">
                              {r.amountCreditedBank || '—'}
                            </td>
                            <td className="px-2.5 py-1.5 border-r text-muted-foreground text-[11px]">{r.creditedDate || '—'}</td>
                            <td className="px-3 py-1.5 border-r text-muted-foreground text-[11px] max-w-[200px] truncate" title={r.note || ''}>
                              {r.note || '—'}
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle2 className="h-3 w-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                                  <AlertCircle className="h-3 w-3" /> Invalid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* COMPACT SUMMARY TABLE */
                  <div className="overflow-x-auto max-h-60 rounded-xl border bg-card">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-muted/60 sticky top-0 border-b font-medium text-muted-foreground text-[11px] uppercase">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Guest Name</th>
                          <th className="px-3 py-2">Room</th>
                          <th className="px-3 py-2">Channel</th>
                          <th className="px-3 py-2">Dates</th>
                          <th className="px-3 py-2 text-right">Guest Charge</th>
                          <th className="px-3 py-2 text-right">Host Payout</th>
                          <th className="px-3 py-2">Bank Credited</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parsedRows.map((r, idx) => (
                          <tr key={idx} className={r.isValid ? 'hover:bg-muted/30' : 'bg-rose-500/5'}>
                            <td className="px-3 py-2 text-muted-foreground">{r.rawLineIndex}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium text-foreground">{r.guestName}</span>
                              {r.reconciliationNote && (
                                <span className="block text-[10px] font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                                  ⚡ {r.reconciliationNote}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {r.roomLabel ? (
                                <span className="font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[11px]">
                                  {r.roomLabel}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-2">{r.source}</td>
                            <td className="px-3 py-2 font-mono text-[11px]">
                              {r.checkInDate} ({r.nights}n)
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-medium">
                              {money(r.guestTotal, 'INR')}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              {money(r.hostTotal, 'INR')}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {r.amountCreditedBank ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {r.amountCreditedBank}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="h-3 w-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                                  <AlertCircle className="h-3 w-3" /> Invalid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Error or Success Notice */}
            {importError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {importError}
              </div>
            )}
            {importSuccessMessage && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {importSuccessMessage}
              </div>
            )}

            {/* Modal Footer */}
            <div className="border-t pt-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="blue-accent"
                size="sm"
                className="text-xs font-semibold"
                disabled={validCount === 0 || isPending}
                onClick={handleImportSubmit}
              >
                {isPending ? (
                  'Importing & Saving Records...'
                ) : (
                  <>
                    Import & Save {validCount} Booking{validCount === 1 ? '' : 's'} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
