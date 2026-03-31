import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import LabResultValue from '@/app/ui/widgets/LabResultValue';

describe('LabResultValue', () => {
  it('renders plain non-culture result with units', () => {
    render(<LabResultValue test={{ name: 'CBC', result: '5.2', units: 'mg/dL' } as any} />);

    expect(screen.getByText('5.2 mg/dL')).toBeInTheDocument();
  });

  it('parses culture-like result into summary, isolates, susceptibility, and interpretation', () => {
    const result = [
      'Specimen: Ear swab',
      'Isolate 1: Escherichia coli',
      'Isolate 1 MIC',
      'Amoxicillin S <=0.25',
      'Cefazolin R >8',
      '**INTERPRETATION KEY**',
      'S = Susceptible',
    ].join('\n');

    render(<LabResultValue test={{ name: 'Culture Results', result } as any} />);

    expect(screen.getByText('Specimen')).toBeInTheDocument();
    expect(screen.getByText('Ear swab')).toBeInTheDocument();
    expect(screen.getByText('Isolate 1: Escherichia coli')).toBeInTheDocument();
    expect(screen.getByText('Antibiotic')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.getByText('<=0.25')).toBeInTheDocument();

    const summary = screen.getByText('Interpretation notes');
    fireEvent.click(summary);
    expect(screen.getByText(/S = Susceptible/)).toBeInTheDocument();
  });

  it('ignores invalid susceptibility lines and malformed isolate indexes', () => {
    const result = [
      'Isolate X: Unknown',
      'Random text',
      'Linezolid maybe 0.5',
      'Amikacin N/I 2',
    ].join('\n');

    render(<LabResultValue test={{ name: 'Culture Results', result } as any} />);

    expect(screen.queryByText(/^Isolate 1:/)).not.toBeInTheDocument();
    expect(screen.getByText('Amikacin')).toBeInTheDocument();
    expect(screen.getByText('N/I')).toBeInTheDocument();
  });
});
