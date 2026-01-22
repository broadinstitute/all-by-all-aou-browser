import styled from "styled-components";
import { GnomadConstraint } from "../types";

const ConstraintTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
  
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
  
    th {
      background-color: #f2f2f2;
    }
  `;

export const GeneConstraintTable = ({
  gnomadConstraint,
}: {
  gnomadConstraint: GnomadConstraint
}) => {
  const highlightColor = (value?: number, upper?: number): string | undefined => {
    if (upper !== undefined) {
      if (upper < 0.33) return '#ff867c'; // subtle red
      if (upper < 0.66) return '#ffcc80'; // subtle orange
      if (upper < 1) return '#ffe082'; // subtle yellow
    } else {
      if (!value) return undefined
      if (value > 3.09) return '#ffcc80'; // subtle orange
    }
    return undefined;
  };

  return (
    <ConstraintTable>
      <thead>
        <tr>
          <th>Category</th>
          <th>Exp/Obs</th>
          <th>Z-score</th>
          <th>Constraint metrics</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Synonymous</td>
          <td>
            {Math.round(gnomadConstraint.exp_syn)}/
            {gnomadConstraint.obs_syn ?? '—'}
          </td>
          <td>{gnomadConstraint.syn_z.toFixed(2)}</td>
          <td>
            {gnomadConstraint.oe_syn.toFixed(2)} (
            {gnomadConstraint.oe_syn_lower.toFixed(2)} -{' '}
            {gnomadConstraint.oe_syn_upper.toFixed(2)})
          </td>
        </tr>
        <tr>
          <td>Missense</td>
          <td>
            {Math.round(gnomadConstraint.exp_mis)}/
            {gnomadConstraint.obs_mis ?? '—'}
          </td>
          <td style={{ backgroundColor: highlightColor(gnomadConstraint.mis_z) }}>
            {gnomadConstraint.mis_z.toFixed(2)}
          </td>
          <td>
            {gnomadConstraint.oe_mis.toFixed(2)} (
            {gnomadConstraint.oe_mis_lower.toFixed(2)} -{' '}
            {gnomadConstraint.oe_mis_upper.toFixed(2)})
          </td>
        </tr>
        <tr>
          <td>pLoF</td>
          <td>
            {Math.round(gnomadConstraint.exp_lof)}/
            {gnomadConstraint.obs_lof ?? '—'}
          </td>
          <td>{gnomadConstraint.lof_z.toFixed(2)}</td>
          <td style={{ backgroundColor: highlightColor(undefined, gnomadConstraint.oe_lof_upper) }}>
            {gnomadConstraint.oe_lof.toFixed(2)} (
            {gnomadConstraint.oe_lof_lower.toFixed(2)} -{' '}
            <span>
              {gnomadConstraint.oe_lof_upper.toFixed(2)}
            </span>
            )
          </td>
        </tr>
      </tbody>
    </ConstraintTable>
  );
};
