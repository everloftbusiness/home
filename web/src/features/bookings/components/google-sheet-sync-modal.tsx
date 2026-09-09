'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Link2,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Building2,
  ArrowRight,
  ShieldAlert,
  Sliders,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { type PropertyOption } from '../types/booking.types';
import {
  testGoogleSheetConnectionAction,
  syncSinglePropertyTabAction,
  syncAllPropertyTabsAction,
  type TabSyncResult,
} from '../actions/dynamic-sheet-sync.action';
import { toast } from 'sonner';

type PropertyMapping = {
  propertyId: string;
  propertyName: string;
  incomeTab: string;
  expenseTab: string;
};

export function GoogleSheetSyncModal({ properties }: { properties: PropertyOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1Q_fEZLHCENn-her2QOSkniZqkP-f6DBe/edit'
  );
  
  // Connection state
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    diagnostic?: string;
    requiresPermission?: boolean;
  } | null>(null);

  // Per-property tab mappings state
  const [mappings, setMappings] = useState<PropertyMapping[]>([]);
  
  // Tab-by-tab sync results map
  const [tabResults, setTabResults] = useState<Record<string, TabSyncResult>>({});
  const [activeSyncingKey, setActiveSyncingKey] = useState<string | null>(null);
  const [isSyncingAll, startTransitionSyncAll] = useTransition();

  // Load saved settings from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedUrl = localStorage.getItem('everloft_google_sheet_url');
        if (savedUrl) setSpreadsheetUrl(savedUrl);

        const savedMappings = localStorage.getItem('everloft_property_sheet_mappings');
        if (savedMappings) {
          setMappings(JSON.parse(savedMappings));
        } else {
          // Initialize default mappings per property
          const init = properties.map((p) => {
            const isPinnacle = p.name.toLowerCase().includes('pinnacle');
            return {
              propertyId: p.id,
              propertyName: p.name,
              incomeTab: isPinnacle ? 'Pinnacle Income' : `${p.name} Income`,
              expenseTab: isPinnacle ? 'Pinnacle Expenses' : `${p.name} Expenses`,
            };
          });
          setMappings(init);
        }
      }
    } catch (err) {
      console.error('Failed to load Google Sheet mapping settings:', err);
    }
  }, [properties]);

  function saveMappings(updated: PropertyMapping[]) {
    setMappings(updated);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('everloft_property_sheet_mappings', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to save mappings:', e);
    }
  }

  function handleUrlChange(newUrl: string) {
    setSpreadsheetUrl(newUrl);
    setConnectionStatus(null);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('everloft_google_sheet_url', newUrl);
      }
    } catch (e) {
      // ignore
    }
  }

  async function handleTestConnection() {
    if (!spreadsheetUrl.trim()) {
      toast.error('Please enter a Google Drive spreadsheet URL');
      return;
    }

    setIsTesting(true);
    try {
      const res = await testGoogleSheetConnectionAction(spreadsheetUrl);
      setConnectionStatus({
        tested: true,
        success: res.success,
        message: res.message,
        diagnostic: res.diagnostic,
        requiresPermission: res.requiresPermission,
      });

      if (res.success) {
        toast.success('Connected to Google Sheet in Google Drive!');
      } else if (res.requiresPermission) {
        toast.error('Google Sheet access restricted (Sign-in required)', { duration: 6000 });
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: 'Network test failed.',
        diagnostic: err instanceof Error ? err.message : String(err),
      });
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  }

  function handleTabNameChange(propertyId: string, field: 'incomeTab' | 'expenseTab', val: string) {
    const updated = mappings.map((m) => (m.propertyId === propertyId ? { ...m, [field]: val } : m));
    saveMappings(updated);
  }

  async function handleSyncSingleTab(
    propertyId: string,
    propertyName: string,
    tabName: string,
    tabType: 'income' | 'expense'
  ) {
    const key = `${propertyId}_${tabType}`;
    setActiveSyncingKey(key);

    try {
      const res = await syncSinglePropertyTabAction({
        spreadsheetUrlOrId: spreadsheetUrl,
        propertyId,
        propertyName,
        tabName,
        tabType,
      });

      setTabResults((prev) => ({ ...prev, [key]: res }));

      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message, { duration: 5000 });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setActiveSyncingKey(null);
    }
  }

  function handleSyncAll() {
    startTransitionSyncAll(async () => {
      try {
        const results = await syncAllPropertyTabsAction({
          spreadsheetUrlOrId: spreadsheetUrl,
          mappings,
        });

        const newMap: Record<string, TabSyncResult> = { ...tabResults };
        let successCount = 0;
        let failCount = 0;

        results.forEach((res) => {
          const key = `${res.propertyId}_${res.tabType}`;
          newMap[key] = res;
          if (res.success) successCount++;
          else failCount++;
        });

        setTabResults(newMap);

        if (failCount === 0) {
          toast.success(`✓ Successfully synced all ${successCount} property tab(s)!`);
        } else {
          toast.warning(`Synced ${successCount} tab(s), ${failCount} tab(s) failed or not found. Check diagnostics below.`);
        }
      } catch (err) {
        toast.error('Sync all failed.');
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 rounded-lg border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 text-xs font-semibold shadow-2xs"
        onClick={() => setIsOpen(true)}
      >
        <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        ⚡ Google Sheet Sync
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[92vh] bg-card border border-border/80 shadow-2xl rounded-2xl p-6 overflow-y-auto space-y-6 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    <Sparkles className="h-3.5 w-3.5" /> Dynamic Google Sheet Sync Manager
                  </span>
                </div>
                <h2 className="mt-1.5 text-2xl font-bold text-foreground">
                  Google Drive Sheet Integration
                </h2>
                <p className="text-xs text-muted-foreground">
                  Connect any Google Sheet link, assign income/expense tab names per property, and run granular tab syncs with instant diagnostics.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* STEP 1: Google Drive Share Link & Connection Status */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Step 1: Google Drive Spreadsheet Share Link
                </label>
                {spreadsheetUrl.trim() && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open in Google Drive <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit..."
                  value={spreadsheetUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="text-xs font-mono h-9 bg-background"
                />
                <Button
                  type="button"
                  variant="blue-accent"
                  size="sm"
                  className="h-9 px-4 text-xs font-semibold whitespace-nowrap"
                  disabled={isTesting}
                  onClick={handleTestConnection}
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Testing...
                    </>
                  ) : (
                    'Connect & Test Sheet'
                  )}
                </Button>
              </div>

              {/* Connection Diagnostics Banner */}
              {connectionStatus && (
                <div
                  className={`rounded-lg border p-3 text-xs space-y-1 ${
                    connectionStatus.success
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {connectionStatus.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-rose-600" />
                    )}
                    {connectionStatus.message}
                  </div>
                  {connectionStatus.diagnostic && (
                    <p className="text-[11px] opacity-90 font-medium pl-6 leading-relaxed">
                      {connectionStatus.diagnostic}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* STEP 2: Property Income & Expense Tab Mapping Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Step 2: Per-Property Tab Assignment & Mapping
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {properties.length} platform properties registered
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-card overflow-x-auto shadow-inner">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-muted/80 border-b text-[11px] font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Property Name</th>
                      <th className="px-3 py-2.5">📥 Income Page Tab Name</th>
                      <th className="px-3 py-2.5">📤 Expense Page Tab Name</th>
                      <th className="px-3 py-2.5 text-center">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {properties.map((p) => {
                      const mapItem = mappings.find((m) => m.propertyId === p.id) || {
                        propertyId: p.id,
                        propertyName: p.name,
                        incomeTab: `${p.name} Income`,
                        expenseTab: `${p.name} Expenses`,
                      };

                      const incKey = `${p.id}_income`;
                      const expKey = `${p.id}_expense`;
                      const incRes = tabResults[incKey];
                      const expRes = tabResults[expKey];

                      const isIncSyncing = activeSyncingKey === incKey;
                      const isExpSyncing = activeSyncingKey === expKey;

                      return (
                        <tr key={p.id} className="hover:bg-muted/20">
                          {/* Property Name */}
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              {p.name}
                            </span>
                          </td>

                          {/* Income Tab Field & Status */}
                          <td className="px-3 py-2.5 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={mapItem.incomeTab}
                                placeholder="e.g. Pinnacle Income"
                                onChange={(e) => handleTabNameChange(p.id, 'incomeTab', e.target.value)}
                                className="h-8 w-48 rounded border border-input bg-background px-2.5 text-xs font-mono"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="h-8 text-[11px] px-2"
                                disabled={isIncSyncing || !mapItem.incomeTab.trim()}
                                onClick={() =>
                                  handleSyncSingleTab(p.id, p.name, mapItem.incomeTab, 'income')
                                }
                              >
                                <RefreshCw className={`mr-1 h-3 w-3 ${isIncSyncing ? 'animate-spin' : ''}`} />
                                Sync
                              </Button>
                            </div>
                            {/* Income Status Badge */}
                            {incRes && (
                              <div
                                className={`text-[10px] font-medium leading-tight flex items-center gap-1 ${
                                  incRes.success
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                                title={incRes.message}
                              >
                                {incRes.success ? (
                                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                )}
                                <span className="truncate max-w-[200px]">{incRes.message}</span>
                              </div>
                            )}
                          </td>

                          {/* Expense Tab Field & Status */}
                          <td className="px-3 py-2.5 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={mapItem.expenseTab}
                                placeholder="e.g. Pinnacle Expenses"
                                onChange={(e) => handleTabNameChange(p.id, 'expenseTab', e.target.value)}
                                className="h-8 w-48 rounded border border-input bg-background px-2.5 text-xs font-mono"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="h-8 text-[11px] px-2"
                                disabled={isExpSyncing || !mapItem.expenseTab.trim()}
                                onClick={() =>
                                  handleSyncSingleTab(p.id, p.name, mapItem.expenseTab, 'expense')
                                }
                              >
                                <RefreshCw className={`mr-1 h-3 w-3 ${isExpSyncing ? 'animate-spin' : ''}`} />
                                Sync
                              </Button>
                            </div>
                            {/* Expense Status Badge */}
                            {expRes && (
                              <div
                                className={`text-[10px] font-medium leading-tight flex items-center gap-1 ${
                                  expRes.success
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                                title={expRes.message}
                              >
                                {expRes.success ? (
                                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                )}
                                <span className="truncate max-w-[200px]">{expRes.message}</span>
                              </div>
                            )}
                          </td>

                          {/* Quick Both Sync Button */}
                          <td className="px-3 py-2.5 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="h-7 text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                              onClick={async () => {
                                if (mapItem.incomeTab.trim()) {
                                  await handleSyncSingleTab(p.id, p.name, mapItem.incomeTab, 'income');
                                }
                                if (mapItem.expenseTab.trim()) {
                                  await handleSyncSingleTab(p.id, p.name, mapItem.expenseTab, 'expense');
                                }
                              }}
                            >
                              Sync Both Tabs
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer / Sync All Actions */}
            <div className="border-t pt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>
                  Tip: Assign tab names corresponding to your Google Sheet pages before clicking Sync All.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </Button>

                <Button
                  type="button"
                  variant="blue-accent"
                  size="sm"
                  className="text-xs font-bold px-4"
                  disabled={isSyncingAll}
                  onClick={handleSyncAll}
                >
                  {isSyncingAll ? (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Syncing All Property Ledgers...
                    </>
                  ) : (
                    <>
                      ⚡ Sync All Property Ledgers <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
