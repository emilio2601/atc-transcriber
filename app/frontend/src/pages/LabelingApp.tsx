import React from "react"
import ChannelSelector from "../components/channel/ChannelSelector"
import ChannelTimeline from "../components/channel/ChannelTimeline"
import TransmissionEditor from "../components/clip/TransmissionEditor"
import LabelingGuideSidebar from "../components/sidebar/LabelingGuideSidebar"
import FlightContextSidebar from "../components/sidebar/FlightContextSidebar"
import { LabelingProvider } from "../context/LabelingContext"

export default function LabelingApp() {
  return (
    <LabelingProvider>
      <div className="min-h-screen">
        <div className="mb-3">
          <ChannelSelector />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {/* Main: 75% */}
          <div className="col-span-3">
            <div className="flex flex-col h-[calc(100vh-160px)]">
              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 p-3">
                <ChannelTimeline />
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 p-3 bg-slate-900/40">
                <TransmissionEditor />
              </div>
            </div>
          </div>
          {/* Sidebar: 25% */}
          <div className="col-span-1">
            <div className="flex flex-col h-[calc(100vh-160px)] gap-3">
              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 p-3">
                <LabelingGuideSidebar />
              </div>
              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 p-3">
                <FlightContextSidebar />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabelingProvider>
  )
}


