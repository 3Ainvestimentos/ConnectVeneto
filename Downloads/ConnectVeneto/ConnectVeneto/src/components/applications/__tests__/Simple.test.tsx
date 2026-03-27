
import React from 'react';
import { render } from '@testing-library/react';

const Simple = () => <div>Simple</div>;

test('renders simple', () => {
  render(<Simple />);
});

