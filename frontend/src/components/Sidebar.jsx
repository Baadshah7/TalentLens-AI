import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Briefcase, Upload, LogOut, User as UserIcon, ShieldAlert } from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/jobs', label: 'Job Positions', icon: Briefcase },
    { to: '/upload', label: 'Resume Upload', icon: Upload },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg glow-accent-violet">
          TL
        </div>
        <div>
          <h1 className="font-semibold text-slate-100 tracking-tight leading-none text-base">TalentLens AI</h1>
          <span className="text-xs text-slate-400 font-medium">Recruitment Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-600/10 text-brand-400 border-l-2 border-brand-500 pl-3.5 glow-accent-indigo'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Status Card */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/40 m-4 rounded-xl">
        <div className="flex items-center space-x-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            {user?.Role === 'Admin' ? <ShieldAlert className="h-5 w-5 text-indigo-400" /> : <UserIcon className="h-5 w-5" />}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-semibold text-slate-200 truncate">{user?.Name || 'Recruiter'}</h4>
            <div className="flex items-center space-x-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${user?.Role === 'Admin' ? 'bg-indigo-400' : 'bg-brand-500'}`}></span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{user?.Role}</span>
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
