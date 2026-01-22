import React, { PureComponent } from 'react'
import { Grid } from '@karaogram/kgui'
import { NoVariants } from '../UserInterface'
import { VariantJoined } from '../types'

type Props = {
  columns: any[]
  highlightText?: string
  onVisibleRowsChange?: (...args: any[]) => any
  onHoverVariant?: (variantId: string) => void
  onRequestSort?: (...args: any[]) => any
  sortKey: string
  sortOrder: 'ascending' | 'descending'
  variants: any[]
  numRowsRendered?: number
  getRowKey?: (...args: any[]) => any
  tiltedLabels?: boolean
}

class VariantTable extends PureComponent<Props> {
  grid = React.createRef()

  render() {
    const {
      columns,
      highlightText = '',
      onVisibleRowsChange,
      onHoverVariant,
      onRequestSort,
      variants,
      sortKey,
      sortOrder,
      numRowsRendered = 5,
      getRowKey = (v: VariantJoined) => v.variant_id,
      tiltedLabels,
    } = this.props
    if (variants.length === 0) {
      return (
        <NoVariants height={500} width={'100%'}>
          No variants found
        </NoVariants>
      )
    }

    return (
      // @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call.
      <Grid
        cellData={{ highlightWords: highlightText.split(/\s+/) }}
        columns={columns}
        data={variants}
        numRowsRendered={numRowsRendered}
        onHoverRow={(rowIndex: any) => {
          onHoverVariant && onHoverVariant(rowIndex === null ? null : variants[rowIndex].variant_id)
        }}
        onRequestSort={onRequestSort}
        onVisibleRowsChange={onVisibleRowsChange}
        ref={this.grid}
        rowKey={getRowKey}
        sortKey={sortKey}
        sortOrder={sortOrder}
        tiltedLabels={tiltedLabels}
      />
    )
  }
}
export default VariantTable
