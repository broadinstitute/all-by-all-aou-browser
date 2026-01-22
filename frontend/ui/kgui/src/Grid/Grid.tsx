/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { transparentize } from "polished";
import React, { Component } from "react";
import styled, { css } from "styled-components";
import { SizeMe } from 'react-sizeme'
import { FixedSizeList } from "react-window";

import { TooltipAnchor } from "../Hover/TooltipAnchor";
import { TooltipHint } from "../Hover/TooltipHint";

export const ColorMarker = styled.span<{ color: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 0.5em;

  &::before {
    content: '';
    display: inline-block;
    box-sizing: border-box;
    width: 10px;
    height: 10px;
    border: 1px solid #000;
    border-radius: 5px;
    background: ${props => props.color};
  }
`

const baseRowStyle = css`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  box-sizing: border-box;
  border-top: 1px solid #e0e0e0;
`;
const baseCellStyle = css`
  display: flex;
  flex-grow: 0;
  flex-shrink: 0;
  align-items: center;
  box-sizing: border-box;
  width: ${(props) => (props as any).width}px;
  padding: 0 0.5em;
  outline: none;

  &:focus {
    box-shadow: inset 0 0 0 2px ${transparentize(0.5, "#428bca")};
  }
`;
const GridWrapper = styled.div`
  width: 100%;

  .grid-row {
    ${baseRowStyle};

    &.grid-row-stripe {
      background: #fff;
    }

    &.grid-row-highlight {
      box-shadow: inset 0 0 0 1px #000;
    }
  }

  .grid-cell {
    ${baseCellStyle};
  }

  .grid-cell-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
const GridHorizontalViewport = styled.div`
  overflow-x: auto;
`;
const HeaderRow = styled.div`
  ${baseRowStyle};
  border-top: none;
  border-bottom: 1px solid #e0e0e0;
`;
const ColumnHeaderBase = styled.div`
  ${baseCellStyle};
  padding: 0.25em 20px 0.25em 0.5em;
  background-position: center right;
  background-repeat: no-repeat;
  font-weight: bold;

  &[aria-sort="ascending"] {
    background-image: url("data:image/gif;base64,R0lGODlhFQAEAIAAACMtMP///yH5BAEAAAEALAAAAAAVAAQAAAINjI8Bya2wnINUMopZAQA7");
  }

  &[aria-sort="descending"] {
    background-image: url("data:image/gif;base64,R0lGODlhFQAEAIAAACMtMP///yH5BAEAAAEALAAAAAAVAAQAAAINjB+gC+jP2ptn0WskLQA7");
  }

  &:focus-within {
    box-shadow: inset 0 0 0 2px ${transparentize(0.5, "#428bca")};
  }

  button {
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    outline: none;
    user-select: none;
  }
`;

const ColumnHeaderTilt = styled(ColumnHeaderBase)`
  font-weight: normal;
  height: 70px;
  max-height: 70px;
  display: flex;
  justify-content: flex-end;
  flex-direction: column;

  .tilted-text {
    font-size: 10px;
    transform: rotate(-25deg);
    margin-bottom: 16px;
    margin-left: 5px;
  }

  .content-text {
    font-weight: bold;
  }
`

const HeadingTooltipWrapper = styled.span`
  max-width: 300px;
  line-height: 1.5;
`;
type GridHeadingTooltipProps = {
  tooltip: string;
};
export const GridHeadingTooltip = ({ tooltip }: GridHeadingTooltipProps) => (
  <HeadingTooltipWrapper>{tooltip}</HeadingTooltipWrapper>
);
type DataRowProps = {
  data: {
    cellData?: any;
    columns: {
      key: string;
      isRowHeader?: boolean;
      render: (...args: any[]) => any;
    }[];
    columnWidths?: number[];
    data: any[];
    focusedCell: {
      columnIndex: number;
      rowIndex: number;
    };
    onMouseEnter: (...args: any[]) => any;
    shouldHighlightRow: (...args: any[]) => any;
  };
  index: number;
  style: any;
};
const DataRow = ({
  index: dataRowIndex,
  data: {
    cellData,
    columns,
    columnWidths,
    data,
    focusedCell,
    onMouseEnter,
    shouldHighlightRow,
  },
  style,
}: DataRowProps) => {
  const rowData = data[dataRowIndex];
  const rowIndex = dataRowIndex + 1; // + 1 for header row
  return (
    <div
      aria-rowindex={rowIndex + 1}
      className={`grid-row ${dataRowIndex % 2 === 0 ? "grid-row-stripe" : ""} ${
        shouldHighlightRow(rowData) ? "grid-row-highlight" : ""
      }`}
      onMouseEnter={onMouseEnter}
      role="row"
      style={style}
    >
      {columns.map((column, columnIndex) => (
        <div
          key={column.key}
          aria-colindex={columnIndex + 1}
          className="grid-cell"
          data-cell={`${columnIndex},${rowIndex}`}
          role={column.isRowHeader ? "rowheader" : "gridcell"}
          tabIndex={
            columnIndex === focusedCell.columnIndex &&
            rowIndex === focusedCell.rowIndex
              ? 0
              : -1
          }
          // @ts-expect-error ts-migrate(2769) FIXME
          style={{ width: columnWidths[columnIndex] }}
        >
          {column.render(rowData, column.key, cellData)}
        </div>
      ))}
    </div>
  );
};
type OwnGridProps = {
  columns: {
    heading?: string;
    key: string;
    isRowHeader?: boolean;
    isSortable?: boolean;
    minWidth?: number;
    render?: (...args: any[]) => any;
    tooltip?: string;
    tiltedLabel?: string;
  }[];
  cellData?: any;
  data: any[];
  numRowsRendered?: number;
  onHoverRow?: (...args: any[]) => any;
  onRequestSort?: (...args: any[]) => any;
  onScroll?: (...args: any[]) => any;
  onVisibleRowsChange?: (...args: any[]) => any;
  rowHeight?: number;
  rowKey?: (...args: any[]) => any;
  shouldHighlightRow?: (...args: any[]) => any;
  sortKey?: string;
  sortOrder?: "ascending" | "descending";
  tiltedLabels?: boolean;
};
type GridProps = OwnGridProps & typeof Grid.defaultProps;
export class Grid extends Component<GridProps> {
  static defaultProps = {
    cellData: {},
    numRowsRendered: 20,
    onHoverRow: () => {},
    onRequestSort: undefined,
    onScroll: () => {},
    onVisibleRowsChange: () => {},
    rowHeight: 25,
    rowKey: (rowData: any) => rowData.key,
    shouldHighlightRow: () => false,
    sortKey: undefined,
    sortOrder: "ascending",
  };
  /* eslint-disable react/sort-comp */
  focusedCell = { columnIndex: 0, rowIndex: 0 };
  focusedElement = null;
  gridElement = React.createRef();
  list = React.createRef();
  /* eslint-enable react/sort-comp */
  // https://www.w3.org/TR/wai-aria-practices/#kbd_roving_tabindex
  onFocus = (e: any) => {
    const targetElement = e.target;
    if (targetElement === this.gridElement.current) {
      this.moveFocusToCell(
        this.focusedCell.columnIndex,
        this.focusedCell.rowIndex
      );
      return;
    }
    const containingCell = targetElement.closest("[data-cell]");
    const [columnIndex, rowIndex] = containingCell.dataset.cell
      .split(",")
      .map(Number);
    // Place tabindex=0 on the currently focused element, remove it from other elements
    (this as any).gridElement.current.setAttribute("tabindex", -1);
    const previouslyFocusedElement = this.focusedElement;
    if (previouslyFocusedElement) {
      (previouslyFocusedElement as any).setAttribute("tabindex", -1);
    }
    targetElement.setAttribute("tabindex", 0);
    this.focusedCell = { columnIndex, rowIndex };
    this.focusedElement = targetElement;
  };
  onItemsRendered = ({ visibleStartIndex, visibleStopIndex }: any) => {
    // If the focused cell is scrolled out of view, place tabindex=0 back on the grid.
    // Since the focused cell's element (the only one with tabindex=0) is destroyed,
    // no element in the grid will be tabbable.
    // After this, onFocus will move focus back to the correct cell when the grid is next focused.
    const focusedDataRowIndex = this.focusedCell.rowIndex - 1;
    if (
      focusedDataRowIndex < visibleStartIndex ||
      focusedDataRowIndex > visibleStopIndex
    ) {
      if (this.focusedElement) {
        this.focusedElement = null;
      }
      (this as any).gridElement.current.setAttribute("tabindex", 0);
    }
    const { onVisibleRowsChange } = this.props;
    onVisibleRowsChange({
      startIndex: visibleStartIndex,
      stopIndex: visibleStopIndex,
    });
  };
  onMouseEnterRow = (e: any) => {
    // -2 because a) aria-rowindex starts at 1 and b) to skip the header row
    const rowIndex = Number(e.currentTarget.getAttribute("aria-rowindex")) - 2;
    const { onHoverRow } = this.props;
    onHoverRow(rowIndex);
  };
  onKeyDown = (e: any) => {
    const { columns, data } = this.props;
    const { columnIndex, rowIndex } = this.focusedCell;
    const numColumns = columns.length;
    const numRows = data.length + 1;
    // TODO: Handle more keys
    // See "Keyboard Interaction for Data Grids" https://www.w3.org/TR/wai-aria-practices/#grid
    switch (e.key) {
      case " ":
        // prevent space key from scrolling
        if (e.target.matches("[data-cell]")) {
          e.preventDefault();
        }
        break;
      case "ArrowUp":
        if (rowIndex > 0) {
          this.moveFocusToCell(columnIndex, rowIndex - 1);
        }
        e.preventDefault(); // prevent scroll (handled by moveFocusToCell)
        break;
      case "ArrowDown":
        if (rowIndex < numRows - 1) {
          this.moveFocusToCell(columnIndex, rowIndex + 1);
        }
        e.preventDefault(); // prevent scroll (handled by moveFocusToCell)
        break;
      case "ArrowLeft":
        if (columnIndex > 0) {
          this.moveFocusToCell(columnIndex - 1, rowIndex);
        }
        e.preventDefault(); // prevent scroll (handled by moveFocusToCell)
        break;
      case "ArrowRight":
        if (columnIndex < numColumns - 1) {
          this.moveFocusToCell(columnIndex + 1, rowIndex);
        }
        e.preventDefault(); // prevent scroll (handled by moveFocusToCell)
        break;
      default:
    }
  };
  moveFocusToCell(columnIndex: any, rowIndex: any) {
    if (rowIndex !== 0) {
      (this as any).list.current.scrollToItem(rowIndex - 1);
    }
    setTimeout(() => {
      // https://www.w3.org/TR/wai-aria-practices/#gridNav_focus
      const cellElement = (this as any).gridElement.current.querySelector(
        `[data-cell="${columnIndex},${rowIndex}"]`
      );
      // Note: supporting widgets that use arrow keys (such as text inputs or select menus)
      // will require changes to the Grid component.
      // See "Editing and Navigating Inside a Cell" https://www.w3.org/TR/wai-aria-practices/#gridNav_focus
      const controlElement = cellElement.querySelector("a, button");
      if (controlElement) {
        controlElement.focus();
      } else {
        cellElement.focus();
      }
    }, 0);
  }
  scrollTo(scrollOffset: any) {
    (this as any).list.current.scrollTo(scrollOffset);
  }
  scrollToDataRow(dataRowIndex: any) {
    // Data row indices are off by one from grid row indices since grid row indices include header row
    (this as any).list.current.scrollToItem(dataRowIndex);
  }
  render() {
    const {
      cellData,
      columns: inputColumns,
      data,
      numRowsRendered,
      onHoverRow,
      onRequestSort,
      onScroll,
      onVisibleRowsChange,
      rowHeight,
      rowKey,
      shouldHighlightRow,
      sortKey,
      sortOrder,
      tiltedLabels,
      ...rest
    } = this.props;
    const columns = inputColumns.map((column) => {
      const columnDefaults = {
        grow: 1,
        heading: column.key,
        tooltip: undefined,
        isRowHeader: false,
        isSortable: false,
        minWidth: 100,
        tiltedLabel: undefined,
        markerColor: 'white',
        render: (rowData: any) => (
          <div className="grid-cell-content">{rowData[column.key]}</div>
        ),
      };
      return { ...columnDefaults, ...column };
    });

    const ariaSortAttr = (column: any) => {
      if (!column.isSortable) {
        return undefined;
      }
      if (column.key !== sortKey) {
        return "none";
      }
      return sortOrder;
    };

    const ColumnHeader = !tiltedLabels ? ColumnHeaderBase : ColumnHeaderTilt

    return (
      <GridWrapper
        {...rest}
        aria-colcount={columns.length}
        aria-rowcount={data.length + 1}
        // @ts-expect-error ts-migrate(2769) FIXME
        ref={this.gridElement}
        role="grid"
        tabIndex={0}
        onFocus={this.onFocus}
        onKeyDown={this.onKeyDown}
        onMouseLeave={() => {
          onHoverRow(null);
        }}
      >
        <SizeMe>
          {({ size }) => {
            const availableWidth = size.width;
            const minGridWidth = columns.reduce(
              (sum, col) => sum + col.minWidth,
              0
            );
            // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
            const remainingWidth = Math.max(availableWidth - minGridWidth, 0);
            const totalGrowFactors =
              columns.reduce((sum, col) => sum + col.grow, 0) || 1;
            // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'number | null' is not assignable... Remove this comment to see the full error message
            const gridWidth = Math.max(availableWidth, minGridWidth);
            const columnWidths = columns.map(
              (col) =>
                col.minWidth + (col.grow / totalGrowFactors) * remainingWidth
            );
            return (
              <GridHorizontalViewport>
                {/* @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call. */}
                <HeaderRow aria-rowindex={1} height={rowHeight} role="row">
                  {columns.map((column, columnIndex) => {
                    let content = column.heading;
                    if (column.tooltip) {
                      // @ts-expect-error ts-migrate(2322) FIXME
                      content = <TooltipHint>{content}</TooltipHint>;
                    }
                    if (column.isSortable) {
                      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
                      content = (
                        <button
                          tabIndex={-1}
                          type="button"
                          // @ts-expect-error ts-migrate(2322) FIXME
                          onClick={() => onRequestSort(column.key)}
                        >
                          {content}
                        </button>
                      );
                    } else {
                      // @ts-expect-error ts-migrate(2322) FIXME
                      content = <span>{content}</span>;
                    }
                    if (column.tooltip) {
                      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
                      content = (
                        <TooltipAnchor
                          // @ts-expect-error ts-migrate(2322) FIXME
                          tooltip={column.tooltip}
                          tooltipComponent={GridHeadingTooltip}
                        >
                          {content}
                        </TooltipAnchor>
                      );
                    }
                     
                    return (
                      <ColumnHeader
                        key={column.key}
                        aria-colindex={columnIndex + 1}
                        aria-sort={ariaSortAttr(column)}
                        data-cell={`${columnIndex},0`}
                        role="columnheader"
                        tabIndex={-1}
                        // @ts-expect-error FIXME
                        width={columnWidths[columnIndex]}
                      >
                        {column.tiltedLabel && <div className="tilted-text"><ColorMarker color={column.markerColor} />{column.tiltedLabel}</div>}  
                        <div className="content-text">{content}</div>
                      </ColumnHeader>
                    );
                  })}
                </HeaderRow>
                <FixedSizeList
                  // With height = numRowsRendered * rowHeight, when scrolled to an offset
                  // which is an exact multiple of rowHeight, onItemsRendered's stopIndex
                  // will be the index of the row after the last row visible. Subtracting
                  // one pixel from the height prevents this.
                  height={numRowsRendered * rowHeight - 1}
                  itemCount={data.length}
                  itemData={{
                    cellData,
                    columns,
                    columnWidths,
                    data,
                    focusedCell: this.focusedCell,
                    onMouseEnter: this.onMouseEnterRow,
                    shouldHighlightRow,
                  }}
                  itemKey={(rowIndex) => rowKey(data[rowIndex])}
                  itemSize={rowHeight}
                  overscanCount={10}
                  // @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call.
                  ref={this.list}
                  style={{
                    overflowX: "hidden",
                  }}
                  width={gridWidth}
                  onItemsRendered={this.onItemsRendered}
                  onScroll={onScroll}
                >
                  {DataRow}
                </FixedSizeList>
              </GridHorizontalViewport>
            );
          }}
        </SizeMe>
      </GridWrapper>
    );
  }
}
