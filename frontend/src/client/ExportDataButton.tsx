import styled from 'styled-components'

import { Button as BaseButton } from '@gnomad/ui'

import downloadCSV from './downloadCSV'

const Button = styled(BaseButton)`
  width: 200px;
  @media (max-width: 700px) {
    margin-top: 0.5em;
  }
`

const exportDataToCSV = (data: any, columns: any, baseFileName: any) => {
  const headerRow = columns.map((col: any) => col.heading)
  const dataRows = data.map((variant: any) =>
    columns.map((col: any) =>
      col.renderForCSV ? col.renderForCSV(variant, col.key) : variant[col.key]
    )
  )
  downloadCSV([headerRow].concat(dataRows), baseFileName)
}

type Props = {
  exportFileName: string
  data: any[]
  columns: any[]
}

const ExportDataButton = ({ exportFileName, columns, data, ...rest }: Props) => (
  <></>
)

export default ExportDataButton


{/* <Button */ }
{/*   {...rest} */ }
{/*   disabled={data.length === 0} */ }
{/*   onClick={() => { */ }
{/*     exportDataToCSV(data, columns, exportFileName) */ }
{/*   }} */ }
{/* > */ }
{/*   Export data to CSV */ }
{/* </Button> */ }
