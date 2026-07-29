export function AppTable({ headers, children, className = "" }) {
  return (
    <div
      className={`overflow-x-auto w-full border border-slate-200 rounded-lg ${className}`}
    >
      <table className="min-w-full divide-y divide-slate-200 bg-white">
        <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold tracking-wider font-mono uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
          {children}
        </tbody>
      </table>
    </div>
  );
}
