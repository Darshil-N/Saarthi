import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Package, Clock, Plus, AlertTriangle } from 'lucide-react';
import { useEntryStats } from '@/hooks/useMaterials';
import { useReceipts } from '@/hooks/useIntake';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = {
  draft: 'secondary',
  processing: 'default',
  confirmed: 'outline',
  rejected: 'destructive',
};

export default function EntryHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useEntryStats();
  const { data: receipts, isLoading: receiptsLoading } = useReceipts({ limit: 10 });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
        ) : (
          <>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4"><Package className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Today's Receipts</p>
                <h3 className="text-2xl font-bold text-slate-800">{stats?.todayReceipts || 0}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
              <div className="bg-yellow-100 p-3 rounded-lg mr-4"><Clock className="h-6 w-6 text-yellow-600" /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Pending Approval</p>
                <h3 className="text-2xl font-bold text-slate-800">{stats?.pendingApprovals || 0}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
              <div className="bg-green-100 p-3 rounded-lg mr-4"><Plus className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">New Materials Today</p>
                <h3 className="text-2xl font-bold text-slate-800">{stats?.newMaterialsToday || 0}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
              <div className="bg-orange-100 p-3 rounded-lg mr-4"><AlertTriangle className="h-6 w-6 text-orange-600" /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Duplicates Detected</p>
                <h3 className="text-2xl font-bold text-slate-800">{stats?.duplicatesDetected || 0}</h3>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Recent Receipts</h2>
        </div>
        
        {receiptsLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !receipts || receipts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No receipts processed yet today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Receipt ID</th>
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Items</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((receipt) => (
                  <tr 
                    key={receipt.id} 
                    onClick={() => navigate(`/entry/history?id=${receipt.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-medium text-slate-700">{receipt.id.split('-')[0]}</td>
                    <td className="px-6 py-4">{receipt.vendor_name || receipt.vendor_id}</td>
                    <td className="px-6 py-4">{new Date(receipt.receipt_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">{receipt.items_count}</td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_COLORS[receipt.status] || 'default'} className="capitalize">
                        {receipt.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
