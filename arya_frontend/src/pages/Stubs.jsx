import React from 'react';
import { MapPin, Wrench, BarChart2, Settings } from 'lucide-react';

const StubPage = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
    <div className="bg-slate-100 p-6 rounded-full mb-6">
      <Icon className="h-12 w-12 text-slate-400" />
    </div>
    <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
    <p className="text-slate-500 max-w-md">{description}</p>
  </div>
);

export const Locations = () => (
  <StubPage 
    icon={MapPin} 
    title="Locations Management" 
    description="Coming soon — configure warehouse locations, zones, and bin codes." 
  />
);

export const EngineerDashboard = () => (
  <StubPage 
    icon={Wrench} 
    title="Engineer Dashboard" 
    description="Engineering review features and technical parameter verification coming soon." 
  />
);

export const AccountsDashboard = () => (
  <StubPage 
    icon={BarChart2} 
    title="Accounts Dashboard" 
    description="Financial reporting and AP reconciliation features coming soon." 
  />
);

export const AdminDashboard = () => (
  <StubPage 
    icon={Settings} 
    title="Admin Dashboard" 
    description="System administration, user management, and global settings coming soon." 
  />
);
