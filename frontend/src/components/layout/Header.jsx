import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';

const roleBadgeVariant = {
  entry_operator: 'default',
  engineer: 'secondary',
  accounts: 'outline',
  admin: 'destructive',
};

const roleLabel = {
  entry_operator: 'Entry Operator',
  engineer: 'Engineer',
  accounts: 'Accounts',
  admin: 'Admin',
};

export default function Header({ title = 'Dashboard' }) {
  const { user, role, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    // Mock logout process
    localStorage.removeItem('mock_auth');
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600 font-medium">
          {user?.full_name || 'User'}
        </span>
        <Badge variant={roleBadgeVariant[role] || 'secondary'}>
          {roleLabel[role] || role}
        </Badge>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
