import React from 'react';
import { Table } from 'semantic-ui-react';

function oiClass(value) {
  if (!value) return '';
  return value > 0 ? 'oi-positive' : 'oi-negative';
}

function Row({ item, fmtInt, fmtFloat, isATM, maxCEVol, maxPEVol }) {
  const ce = item.CE || {};
  const pe = item.PE || {};

  return (
    <Table.Row className={isATM ? 'atm-row' : ''}>
      {/* CALLS */}
      <Table.Cell className="iv-cell">{fmtFloat(ce.impliedVolatility)}</Table.Cell>
      <Table.Cell>{fmtFloat(ce.lastPrice)}</Table.Cell>
      <Table.Cell className={ce.totalTradedVolume === maxCEVol ? 'vol-highlight' : 'vol-cell'}>
        {Math.trunc(fmtFloat(ce.totalTradedVolume) / 1000)}
      </Table.Cell>
      <Table.Cell>{fmtInt(ce.openInterest)}</Table.Cell>
      <Table.Cell className={`oi-change-cell ${oiClass(ce.changeinOpenInterest)}`}>
        {fmtInt(ce.changeinOpenInterest)}
      </Table.Cell>

      {/* STRIKE */}
      <Table.Cell className="strike-cell" textAlign="center">
        {fmtInt(item.strikePrice)}
      </Table.Cell>

      {/* PUTS */}
      <Table.Cell className={`oi-change-cell ${oiClass(pe.changeinOpenInterest)}`}>
        {fmtInt(pe.changeinOpenInterest)}
      </Table.Cell>
      <Table.Cell>{fmtInt(pe.openInterest)}</Table.Cell>
      <Table.Cell className={pe.totalTradedVolume === maxPEVol ? 'vol-highlight' : 'vol-cell'}>
        {Math.trunc(fmtFloat(pe.totalTradedVolume) / 1000)}
      </Table.Cell>
      <Table.Cell>{fmtFloat(pe.lastPrice)}</Table.Cell>
      <Table.Cell className="iv-cell">{fmtFloat(pe.impliedVolatility)}</Table.Cell>
    </Table.Row>
  );
}

export default function OptionTable({ items, atmStrike, fmtInt, fmtFloat }) {
  const maxCEVol = Math.max(...items.map((it) => it.CE?.totalTradedVolume || 0));
  const maxPEVol = Math.max(...items.map((it) => it.PE?.totalTradedVolume || 0));

  return (
    <div style={{ overflowX: 'auto' }}>
      <Table celled structured compact textAlign="center" className="option-chain-table">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell colSpan="5" className="calls-header">CALLS</Table.HeaderCell>
            <Table.HeaderCell>STRIKE</Table.HeaderCell>
            <Table.HeaderCell colSpan="5" className="puts-header">PUTS</Table.HeaderCell>
          </Table.Row>
          <Table.Row>
            <Table.HeaderCell>IV</Table.HeaderCell>
            <Table.HeaderCell>LTP</Table.HeaderCell>
            <Table.HeaderCell>Vol</Table.HeaderCell>
            <Table.HeaderCell>OI</Table.HeaderCell>
            <Table.HeaderCell>ΔOI</Table.HeaderCell>
            <Table.HeaderCell></Table.HeaderCell>
            <Table.HeaderCell>ΔOI</Table.HeaderCell>
            <Table.HeaderCell>OI</Table.HeaderCell>
            <Table.HeaderCell>Vol</Table.HeaderCell>
            <Table.HeaderCell>LTP</Table.HeaderCell>
            <Table.HeaderCell>IV</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((it) => (
            <Row
              key={it.strikePrice}
              item={it}
              fmtInt={fmtInt}
              fmtFloat={fmtFloat}
              isATM={Number(it.strikePrice) === atmStrike}
              maxCEVol={maxCEVol}
              maxPEVol={maxPEVol}
            />
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
