import React from "react"
import ChannelSelector from "../components/channel/ChannelSelector"
import ChannelTimeline from "../components/channel/ChannelTimeline"
import TransmissionEditor from "../components/clip/TransmissionEditor"
import LabelingGuideSidebar from "../components/sidebar/LabelingGuideSidebar"
import FlightContextSidebar from "../components/sidebar/FlightContextSidebar"
import { LabelingProvider } from "../context/LabelingContext"
import LabelingPager from "../components/channel/LabelingPager"

export default function LabelingApp() {
  return (
    <LabelingProvider>
      <div className="min-h-screen text-base">
        <div className="mb-3 flex items-center gap-3">
          <ChannelSelector />
          <LabelingPager />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {/* Main: 75% */}
          <div className="col-span-3">
            <div className="flex flex-col h-[calc(100vh-160px)] gap-6">
              <div className="h-[68vh] rounded-xl border border-slate-800 p-4 pb-6">
                <ChannelTimeline />
              </div>
              <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/40">
                <TransmissionEditor />
              </div>
            </div>
          </div>
          {/* Sidebar: 25% */}
          <div className="col-span-1">
            <div className="flex flex-col h-[calc(100vh-160px)] gap-6">
              <div className="h-[33vh] overflow-y-auto rounded-xl border border-slate-800 p-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <LabelingGuideSidebar />
              </div>
              <div className="h-[33.5vh] overflow-y-auto rounded-xl border border-slate-800 p-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <FlightContextSidebar />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabelingProvider>
  )
}


