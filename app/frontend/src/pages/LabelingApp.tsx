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
      <div className="min-h-screen">
        <div className="reveal mb-4 flex flex-wrap items-center gap-3">
          <ChannelSelector />
          <LabelingPager />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {/* Main: 75% */}
          <div className="col-span-4 lg:col-span-3">
            <div className="flex flex-col h-[calc(100vh-150px)] gap-4">
              <div
                className="reveal panel corners flex-1 min-h-0 p-4"
                style={{ animationDelay: "60ms" }}
              >
                <ChannelTimeline />
              </div>
              <div
                className="reveal panel corners p-4"
                style={{ animationDelay: "120ms" }}
              >
                <TransmissionEditor />
              </div>
            </div>
          </div>
          {/* Sidebar: 25% */}
          <div className="col-span-4 lg:col-span-1">
            <div className="flex flex-col h-[calc(100vh-150px)] gap-4">
              <div
                className="reveal panel overflow-y-auto p-4"
                style={{ animationDelay: "180ms" }}
              >
                <LabelingGuideSidebar />
              </div>
              <div
                className="reveal panel flex-1 min-h-0 overflow-y-auto p-4"
                style={{ animationDelay: "240ms" }}
              >
                <FlightContextSidebar />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabelingProvider>
  )
}
