export const SidebarInput = ({ icon, placeholder, value, onChange }) => (
  <div className="relative group">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
      {icon}
    </div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-medium focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50 transition-all outline-none"
      placeholder={placeholder}
    />
  </div>
);