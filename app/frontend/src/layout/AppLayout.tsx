import React from "react"

export default function AppLayout({ left, center, right }: { left?: React.ReactNode; center?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-3">
        {left || <div className="rounded-xl border border-slate-800 p-3">Left</div>}
      </div>
      <div className="col-span-6">
        {center || <div className="rounded-xl border border-slate-800 p-3">Center</div>}
      </div>
      <div className="col-span-3">
        {right || <div className="rounded-xl border border-slate-800 p-3">Right</div>}
      </div>
    </div>
  )
}


