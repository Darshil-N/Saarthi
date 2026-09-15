import React from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIntakeStore } from '@/store/intakeStore';
import MatchStatusBadge from '@/components/intake/MatchStatusBadge';
import CNMCBadge from '@/components/materials/CNMCBadge';
import { cn } from '@/lib/utils';
import { useLocations } from '@/hooks/useMaterials';

export default function LineItemEditor({ item, index, readOnly = false }) {
  const updateLineItem = useIntakeStore((s) => s.updateLineItem);
  const removeLineItem = useIntakeStore((s) => s.removeLineItem);
  const { data: locations = [] } = useLocations();

  const set = (field, value) => updateLineItem(item.line_id, { [field]: value });

  const locationMissing = !readOnly && !item.location_code;
  const qualityMissing = !readOnly && !item.quality_grade;

  return (
    <tr className="border-b hover:bg-slate-50 text-sm align-top">
      <td className="px-3 py-2 text-slate-500 w-8">{index + 1}</td>

      <td className="px-3 py-2 min-w-[180px]">
        {readOnly ? (
          <span className="text-slate-800">{item.description}</span>
        ) : (
          <Input
            value={item.description}
            onChange={(e) => set('description', e.target.value)}
            className="h-8 text-xs"
          />
        )}
        {item.matched_description && (
          <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
            ↳ {item.matched_description}
          </div>
        )}
      </td>

      <td className="px-3 py-2 w-20">
        {readOnly ? (
          <span>{item.quantity}</span>
        ) : (
          <Input
            type="number"
            value={item.quantity}
            onChange={(e) => set('quantity', parseFloat(e.target.value))}
            className="h-8 text-xs w-20"
          />
        )}
      </td>

      <td className="px-3 py-2 w-16">
        {readOnly ? (
          <span>{item.unit}</span>
        ) : (
          <Input
            value={item.unit}
            onChange={(e) => set('unit', e.target.value)}
            className="h-8 text-xs w-16"
          />
        )}
      </td>

      <td className="px-3 py-2 w-28">
        {readOnly ? (
          <span>₹{item.unit_price?.toFixed(2)}</span>
        ) : (
          <Input
            type="number"
            value={item.unit_price}
            onChange={(e) => set('unit_price', parseFloat(e.target.value))}
            className="h-8 text-xs w-24"
          />
        )}
      </td>

      <td className="px-3 py-2">
        <CNMCBadge
          cnmc={item.cnmc}
          is_new_material={item.is_new_material}
          editable={!readOnly && item.is_new_material}
          onEdit={(val) => set('cnmc', val)}
        />
      </td>

      <td className="px-3 py-2">
        <MatchStatusBadge
          match_status={item.match_status}
          confidence={item.confidence}
          match_reason={item.match_reason}
        />
      </td>

      <td className="px-3 py-2 w-24">
        {readOnly ? (
          <span className={cn(
            'px-2 py-0.5 rounded text-xs font-semibold',
            item.quality_grade === 'A' ? 'bg-green-100 text-green-800' :
            item.quality_grade === 'B' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          )}>{item.quality_grade}</span>
        ) : (
          <Select
            value={item.quality_grade || ''}
            onValueChange={(val) => set('quality_grade', val)}
          >
            <SelectTrigger className={cn('h-8 text-xs w-20', qualityMissing && 'border-red-400')}>
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>

      <td className="px-3 py-2 min-w-[140px]">
        {readOnly ? (
          <span className="font-mono text-xs">{item.location_code}</span>
        ) : (
          <Select
            value={item.location_code || ''}
            onValueChange={(val) => set('location_code', val)}
          >
            <SelectTrigger className={cn('h-8 text-xs', locationMissing && 'border-red-400')}>
              <SelectValue placeholder="Select Location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.code} value={loc.code}>
                  {loc.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>

      {!readOnly && (
        <td className="px-3 py-2 w-10">
          <button
            type="button"
            onClick={() => removeLineItem(item.line_id)}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}
