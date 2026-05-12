import React from 'react';
import { Grid, Header, List, Segment } from 'semantic-ui-react';

export default function OIHistory({ history, fmtInt }) {
  const colorFor = (v) => (v > 0 ? 'green' : v < 0 ? 'red' : undefined);

  const renderList = (items) => (
    <List divided relaxed>
      {items.length === 0 ? (
        <List.Item>
          <List.Content>
            <span style={{ color: '#999', fontSize: '0.9em' }}>No data yet</span>
          </List.Content>
        </List.Item>
      ) : (
        items.map((item, i) => (
          <List.Item key={i}>
            <List.Content floated="right">
              <span style={{ fontWeight: 700, color: colorFor(item.value) === 'green' ? '#21ba45' : colorFor(item.value) === 'red' ? '#db2828' : '#333' }}>
                {fmtInt(item.value)}
              </span>
            </List.Content>
            <List.Content>
              <span style={{ color: '#888', fontSize: '0.85em' }}>{item.time}</span>
            </List.Content>
          </List.Item>
        ))
      )}
    </List>
  );

  return (
    <Grid columns={2} stackable style={{ marginTop: '1rem' }}>
      <Grid.Column>
        <Segment>
          <Header as="h4" textAlign="center" dividing>Call OI History</Header>
          {renderList(history.calls)}
        </Segment>
      </Grid.Column>
      <Grid.Column>
        <Segment>
          <Header as="h4" textAlign="center" dividing>Put OI History</Header>
          {renderList(history.puts)}
        </Segment>
      </Grid.Column>
    </Grid>
  );
}
