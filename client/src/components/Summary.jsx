import React from 'react';
import { Segment, Statistic } from 'semantic-ui-react';

export default function Summary({ aggregate, fmtInt }) {
  const callColor = aggregate.calls > 0 ? 'green' : aggregate.calls < 0 ? 'red' : undefined;
  const putColor  = aggregate.puts  > 0 ? 'green' : aggregate.puts  < 0 ? 'red' : undefined;

  return (
    <Segment textAlign="center" style={{ marginBottom: '1rem' }}>
      <Statistic.Group widths="two" size="small">
        <Statistic color={callColor}>
          <Statistic.Value>{fmtInt(aggregate.calls)}</Statistic.Value>
          <Statistic.Label>CALL ΔOI</Statistic.Label>
        </Statistic>
        <Statistic color={putColor}>
          <Statistic.Value>{fmtInt(aggregate.puts)}</Statistic.Value>
          <Statistic.Label>PUT ΔOI</Statistic.Label>
        </Statistic>
      </Statistic.Group>
    </Segment>
  );
}
