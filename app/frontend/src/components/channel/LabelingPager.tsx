import React from "react"
import { useLabeling } from "../../context/LabelingContext"
import { Pager } from "../../common/ui"

export default function LabelingPager() {
  const { meta, setPage } = useLabeling()

  if (!meta) return null

  return (
    <div className="panel px-3 py-2">
      <Pager meta={meta} onPage={setPage} />
    </div>
  )
}
